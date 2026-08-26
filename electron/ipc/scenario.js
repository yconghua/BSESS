/**
 * 路由层（IPC Layer）—— 疏散场景路由（scenario:* 前缀）
 *
 * 场景的保存 / 列表 / 详情 / 删除，业务落在 scenarioService；
 * 路由只做转发与未预期异常兜底。
 */
const scenarioService = require('../services/scenarioService')

// 注册所有 scenario:* 路由。ipcMain 由 main.js 传入。
function register(ipcMain) {
  // 保存场景（新增）
  ipcMain.handle('scenario:save', async (_evt, payload) => {
    try {
      return await scenarioService.save(payload)
    } catch (err) {
      console.error('[scenario:save] 未预期异常:', err)
      return { success: false, message: err.code === 'NO_LOGIN' ? '未登录，请重新登录' : '保存失败，请稍后重试' }
    }
  })

  // 当前用户场景列表
  ipcMain.handle('scenario:list', async () => {
    try {
      return await scenarioService.list()
    } catch (err) {
      console.error('[scenario:list] 未预期异常:', err)
      return { success: false, message: '读取场景列表失败' }
    }
  })

  // 场景详情（加载复用）
  ipcMain.handle('scenario:get', async (_evt, { id }) => {
    try {
      return await scenarioService.get(id)
    } catch (err) {
      console.error('[scenario:get] 未预期异常:', err)
      return { success: false, message: '读取场景失败' }
    }
  })

  // 删除场景
  ipcMain.handle('scenario:delete', async (_evt, { id }) => {
    try {
      return await scenarioService.remove(id)
    } catch (err) {
      console.error('[scenario:delete] 未预期异常:', err)
      return { success: false, message: '删除失败' }
    }
  })
}

module.exports = { register }
