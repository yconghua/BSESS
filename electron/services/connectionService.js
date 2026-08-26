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
// 默认连接清单（阿里云预设）抽到独立文件，便于不改本服务即可调整预设
const { defaultConnections } = require('../db/database_default_connections')
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

// 加载连接清单：文件存在且合法则读取，否则回退默认清单并落盘
function loadConnections() {
  try {
    const p = connsPath()
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, 'utf8'))
      if (data && Array.isArray(data.list) && data.list.length) return data
    }
  } catch (e) {
    console.error('[connectionService] 读取失败，使用默认:', e)
  }
  const def = defaultConnections()
  saveConnections(def)
  return def
}

// 写回连接清单（失败仅记录，不阻断流程）
function saveConnections(data) {
  try {
    fs.writeFileSync(connsPath(), JSON.stringify(data || connections, null, 2))
  } catch (e) {
    console.error('[connectionService] 写入失败:', e)
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
 * 由 main.js 在窗口创建前调用一次。
 */
function init() {
  connections = loadConnections()
  activeConfig = buildConfig(getActiveConn())
  setActiveConfig(activeConfig) // 建立连接池，handler 不再各自建连
  return { success: true }
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
  return { success: true, id, message: '已添加连接「' + name + '」，并完成初始化' }
}

// 删除连接：默认库禁止删、在用需先切、至少保留一个（后端兜底）
async function remove(id) {
  const target = connections.list.find((x) => x.id === id)
  if (!target) return { success: false, message: '未找到该连接' }
  // 阿里云为默认数据库，任何情况都禁止删除
  if (id === 'aliyun') {
    return { success: false, message: '该数据库为默认数据库，禁止删除' }
  }
  if (connections.list.length <= 1) {
    return { success: false, message: '至少保留一个连接，无法删除' }
  }
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
