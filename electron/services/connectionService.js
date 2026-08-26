/**
 * 连接服务（Service Layer）—— 数据库连接配置的纯业务逻辑
 *
 * 职责：
 *   1. 连接清单的加载 / 持久化（userData 目录下的 db-connections.json，天然不进版本库）；
 *   2. 连接配置的增 / 删 / 切换（CRUD）与启动注入连接层（setActiveConfig）；
 *   3. 连接探活（SELECT 1）。
 *
 * 本服务只处理「连接本身」的业务，不编写任何 user 表的业务 SQL——
 * 那些在 authService 中。上层（ipc/sys.js）只调用这里暴露的方法。
 */
const fs = require('node:fs')
const path = require('node:path')
const mysql = require('mysql2/promise')
const { app } = require('electron')
// 数据库初始化公共模块（建库 + user 表 + 默认管理员），供「新增连接」自动初始化
const { initDatabase } = require('../db/create_new_database')
// 连接层：统一管理连接池；本服务只通过它切换活跃连接，不直接建池
const { setActiveConfig, getActiveConfig } = require('../db/connection')
// 前后端共享常量（默认端口等），单一事实来源，避免硬编码
const { DEFAULT_DB_PORT } = require('../../shared/constants')

// 连接清单持久化路径：优先放到用户数据目录，electron 未完全就绪时回退到项目目录
function connsPath() {
  try {
    return path.join(app.getPath('userData'), 'db-connections.json')
  } catch (e) {
    return path.join(__dirname, '..', 'db-connections.json')
  }
}

// 内存中的连接清单（启动时加载，运行时增删改后写回磁盘）
let connections = null
// 当前生效的 mysql2 连接配置（注入连接层，供 sys:db-info 读取元信息）
let activeConfig = null

// 加载连接清单：文件存在且合法则读取，否则返回空清单（不再内置任何默认/预留数据库）
function loadConnections() {
  try {
    const p = connsPath()
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, 'utf8'))
      if (data && Array.isArray(data.list)) return data
    }
  } catch (e) {
    console.error('[connectionService] 读取失败，使用空清单:', e)
  }
  const empty = { active: '', list: [] }
  saveConnections(empty)
  return empty
}

// 写回连接清单（失败仅记录，不阻断流程）
function saveConnections(data) {
  try {
    fs.writeFileSync(connsPath(), JSON.stringify(data || connections, null, 2))
  } catch (e) {
    console.error('[connectionService] 写入失败:', e)
  }
}

// schemas 已应用版本号的持久化路径（与连接清单同级，天然不进版本库）
function schemaVersionPath() {
  try {
    return path.join(app.getPath('userData'), 'schema-version.json')
  } catch (e) {
    return path.join(__dirname, '..', 'schema-version.json')
  }
}
// 读取上次已应用 schemas 的系统版本号（无则返回空串）
function loadSchemaVersion() {
  try {
    const p = schemaVersionPath()
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, 'utf8'))
      return (data && data.version) || ''
    }
  } catch (e) {}
  return ''
}
// 记录本次已应用 schemas 的系统版本号
function saveSchemaVersion(v) {
  try {
    fs.writeFileSync(schemaVersionPath(), JSON.stringify({ version: v }, null, 2))
  } catch (e) {
    console.error('[connectionService] 写入 schema 版本失败:', e)
  }
}

// 取「当前生效」连接对象：connections.active 指向的，缺失则取第一个
function getActiveConn() {
  const c = connections.list.find((x) => x.id === connections.active)
  return c || connections.list[0]
}

// 将连接对象转换为 mysql2 连接配置（统一 dateStrings，让时间字段返回字符串）
function buildConfig(conn) {
  return {
    host: conn.host,
    port: Number(conn.port) || DEFAULT_DB_PORT,
    user: conn.user,
    password: conn.password,
    database: conn.database,
    dateStrings: true
  }
}

/**
 * 启动初始化：加载清单 + 构建当前生效配置 + 注入连接层。
 * 须在 app ready 之后调用（app.getPath 依赖 ready 状态）。
 * 由 main.js 在窗口创建前调用一次（await）。
 * 若清单为空（尚未配置任何数据库），进入「未配置」状态，不建立连接池。
 * 若系统版本号变化（或首次），对所有已配置数据库连接重放 schemas/*.sql 补齐表结构。
 */
async function init() {
  connections = loadConnections()
  if (!connections.list.length) {
    // 未配置任何数据库：进入「未配置」状态，不建立连接池
    activeConfig = null
    return { success: true, configured: false }
  }
  activeConfig = buildConfig(getActiveConn())
  setActiveConfig(activeConfig) // 建立连接池，handler 不再各自建连

  // 系统版本号变化（或首次）时，对所有已配置数据库连接重新执行 schemas/*.sql，
  // 以补齐随版本迭代新增的表 / 字段。SQL 本身幂等（IF NOT EXISTS），重复执行安全。
  const currentVersion = app.getVersion()
  if (loadSchemaVersion() !== currentVersion) {
    for (const conn of connections.list) {
      try {
        await initDatabase(conn)
      } catch (e) {
        console.error(
          '[connectionService] 版本变更重放 schemas 失败（' + conn.name + '）：',
          e && e.message ? e.message : e
        )
      }
    }
    saveSchemaVersion(currentVersion)
  }
  return { success: true, configured: true }
}

// 探活：建一条临时连接执行 SELECT 1，成功返回 ok，失败返回原因（失败也安全关闭连接）
async function ping(cfg) {
  let conn
  try {
    conn = await mysql.createConnection(cfg)
    await conn.execute('SELECT 1')
    return { ok: true }
  } catch (e) {
    return { ok: false, message: e && e.message ? e.message : '连接失败' }
  } finally {
    if (conn) await conn.end().catch(() => {})
  }
}

// 返回当前生效连接的元信息（不含密码），供 sys:db-info 展示
function getActiveMeta() {
  if (!activeConfig) return null
  const cfg = activeConfig
  return { host: cfg.host, user: cfg.user, port: cfg.port, database: cfg.database }
}

// 返回连接清单（脱敏：不含 password，仅用 hasPassword 标记），以及当前生效 id，供前端展示 / 切换
function list() {
  const list = connections.list.map((c) => ({
    id: c.id,
    name: c.name,
    host: c.host,
    port: c.port,
    database: c.database,
    hasPassword: !!c.password
  }))
  return { active: connections.active, list }
}

// 切换当前生效连接：先探活，成功才生效并持久化 + 注入连接层
async function switchConnection(id) {
  const target = connections.list.find((x) => x.id === id)
  if (!target) return { success: false, message: '未找到该连接' }
  const cfg = buildConfig(target)
  const test = await ping(cfg)
  if (!test.ok) return { success: false, message: '连接失败：' + test.message }
  connections.active = id
  activeConfig = cfg
  setActiveConfig(cfg) // 关键：让连接池绑定到新连接
  saveConnections()
  return { success: true, message: '已切换到「' + target.name + '」' }
}

// 新增连接：先连库自动初始化（建库 + 建表 + 默认管理员），成功才写入清单
async function add(payload) {
  const { name, host, port, user, password, database } = payload || {}
  if (!name || !host || !user || !database) {
    return { success: false, message: '请填写名称、主机、账号与数据库名' }
  }
  if (!/^[A-Za-z0-9_]+$/.test(database)) {
    return { success: false, message: '数据库名仅支持字母、数字、下划线' }
  }
  const id = 'user-' + Date.now()
  const conn = { id, name, host, port: Number(port) || DEFAULT_DB_PORT, user, password: password || '', database }
  // 自动初始化：库不存在会先建库，再建 user 表、插入默认管理员 admin/admin123
  try {
    await initDatabase(conn)
  } catch (err) {
    return {
      success: false,
      message: '初始化失败（请确认账号可连接且有建库/建表权限）：' + (err && err.message ? err.message : err)
    }
  }
  connections.list.push(conn)
  saveConnections()
  // 若当前没有生效连接（如首次添加），自动把新库设为生效并建池，
  // 这样加完首个库即可直接登录，无需手动切换（不涉及任何提示弹窗）
  if (!connections.active) {
    connections.active = id
    activeConfig = buildConfig(conn)
    setActiveConfig(activeConfig)
  }
  return { success: true, id, message: '已添加连接「' + name + '」，并完成初始化' }
}

// 删除连接：列表中的任意连接均可删，除了「正在使用的（当前生效）」连接
async function remove(id) {
  const target = connections.list.find((x) => x.id === id)
  if (!target) return { success: false, message: '未找到该连接' }
  // 正在使用的连接不能删，需先切换到其他连接
  if (id === connections.active) {
    return { success: false, message: '请先切换到其他连接再删除' }
  }
  connections.list = connections.list.filter((x) => x.id !== id)
  saveConnections()
  return { success: true, message: '已删除连接「' + target.name + '」' }
}

module.exports = {
  init,
  ping,
  getActiveMeta,
  getActiveConfig, // 透传连接层当前配置（sys:db-info 探活时用）
  list,
  switchConnection,
  add,
  remove
}
