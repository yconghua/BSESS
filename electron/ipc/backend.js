/**
 * 路由层（IPC Layer）—— 后端计算服务管理路由（backend:* 前缀）
 *
 * 供渲染层查询 / 启停 FastAPI sidecar：
 *   - backend:status           查询当前状态（status/port/url）
 *   - backend:start            拉起计算服务（幂等）
 *   - backend:stop             停止计算服务
 *   - backend:status-changed   状态变更事件（广播给所有窗口）
 *
 * 真正的进程管理落在 services/backendService.js，此处只做转发。
 */
const backendService = require('../services/backendService')

// 注册所有 backend:* 路由。ipcMain 由 main.js 传入。
function register(ipcMain) {
  ipcMain.handle('backend:status', () => ({ success: true, ...backendService.getStatus() }))

  ipcMain.handle('backend:start', async () => {
    try {
      return { success: true, ...(await backendService.start()) }
    } catch (err) {
      console.error('[backend:start] 未预期异常:', err)
      return { success: false, message: '后端启动失败，请稍后重试' }
    }
  })

  ipcMain.handle('backend:stop', () => {
    backendService.stop()
    return { success: true, ...backendService.getStatus() }
  })

  // 状态变化 → 广播给所有窗口（登录页 / 疏散页都能实时感知）
  backendService.onStatusChange((status) => {
    const { BrowserWindow } = require('electron')
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('backend:status-changed', status)
    }
  })
}

module.exports = { register }
