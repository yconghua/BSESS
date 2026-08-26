/**
 * 路由层（IPC Layer）—— 系统管理相关路由（sys:* 前缀）
 *
 * 本模块负责「系统设置 / 数据库管理」两类前端能力：
 *   - sys:info / sys:db-info / sys:db-connections / sys:switch-db / sys:add-db / sys:delete-db
 * 路由只做转发与必要的登录态判定（sys:info 需登录），真正的业务落到 connectionService；
 * 系统名称 / 版本号来自 package.json（写活不硬编码）。不在此处写 SQL。
 */
const path = require('node:path')
// 读取 package.json，供「系统管理」展示系统名称 / 版本号
const appPkg = require('../../package.json')
const connectionService = require('../services/connectionService')
const authService = require('../services/authService')

// 注册所有 sys:* 路由。ipcMain 由 main.js 传入。
function register(ipcMain) {
  // 系统名称 / 版本号（需登录）
  ipcMain.handle('sys:info', async () => {
    if (!authService.getCurrentUser()) {
      return { success: false, message: '未登录，请重新登录' }
    }
    return {
      success: true,
      name: (appPkg.build && appPkg.build.productName) || appPkg.name,
      version: appPkg.version
    }
  })

  // 当前生效数据库信息 + 实时连接状态（SELECT 1 探活）；不要求登录，供登录页「系统设置」展示
  ipcMain.handle('sys:db-info', async () => {
    const cfg = connectionService.getActiveConfig()
    const meta = connectionService.getActiveMeta()
    const test = await connectionService.ping(cfg)
    if (test.ok) {
      return { success: true, ...meta, status: 'connected' }
    }
    return { success: true, ...meta, status: 'disconnected', error: test.message }
  })

  // 连接清单（脱敏，不含密码）
  ipcMain.handle('sys:db-connections', async () => {
    return { success: true, ...connectionService.list() }
  })

  // 切换当前生效连接
  ipcMain.handle('sys:switch-db', async (_evt, { id }) => {
    try {
      return await connectionService.switchConnection(id)
    } catch (err) {
      console.error('[sys:switch-db] 未预期异常:', err)
      return { success: false, message: '切换失败，请稍后重试' }
    }
  })

  // 新增连接
  ipcMain.handle('sys:add-db', async (_evt, payload) => {
    try {
      return await connectionService.add(payload)
    } catch (err) {
      console.error('[sys:add-db] 未预期异常:', err)
      return { success: false, message: '添加失败，请稍后重试' }
    }
  })

  // 删除连接
  ipcMain.handle('sys:delete-db', async (_evt, { id }) => {
    try {
      return await connectionService.remove(id)
    } catch (err) {
      console.error('[sys:delete-db] 未预期异常:', err)
      return { success: false, message: '删除失败，请稍后重试' }
    }
  })
}

module.exports = { register }
