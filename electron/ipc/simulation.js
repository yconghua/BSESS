/**
 * 路由层（IPC Layer）—— 仿真记录路由（sim:* 前缀）
 *
 * 记录写入 / 列表 / 详情，业务落在 simulationRecordService；
 * 路由只做转发与未预期异常兜底。
 */
const simulationRecordService = require('../services/simulationRecordService')

// 注册所有 sim:* 路由。ipcMain 由 main.js 传入。
function register(ipcMain) {
  // 写入一条仿真记录（每次疏散结束后调用）
  ipcMain.handle('sim:save', async (_evt, payload) => {
    try {
      return await simulationRecordService.save(payload)
    } catch (err) {
      console.error('[sim:save] 未预期异常:', err)
      return { success: false, message: '记录保存失败，请稍后重试' }
    }
  })

  // 当前用户仿真记录列表（摘要）
  ipcMain.handle('sim:list', async () => {
    try {
      return await simulationRecordService.list()
    } catch (err) {
      console.error('[sim:list] 未预期异常:', err)
      return { success: false, message: '读取记录列表失败' }
    }
  })

  // 记录详情（含完整 paths，供回放 / 分析）
  ipcMain.handle('sim:get', async (_evt, { id }) => {
    try {
      return await simulationRecordService.get(id)
    } catch (err) {
      console.error('[sim:get] 未预期异常:', err)
      return { success: false, message: '读取记录失败' }
    }
  })
}

module.exports = { register }
