/**
 * 预加载脚本
 *
 * 在主进程与渲染层之间架桥：只把「认证 / 系统」相关的 API 通过 contextBridge
 * 暴露到 window.api，渲染层拿不到 ipcRenderer 本体，安全性更高。
 *
 * 调用统一由 createInvoke 工厂封装，消除每个方法重复的箭头函数样板：
 *   - 约定：每个方法至多向主进程发送「一个 payload 对象」（无参方法发送 undefined）；
 *   - 新增模块 / 方法只需在对应对象里按相同格式追加一行；
 *   - 后续若要统一加日志、错误处理、超时等，只改 createInvoke 一处即可。
 */
const { contextBridge, ipcRenderer } = require('electron')

// 工厂：把「某个 IPC 通道」固化成一个函数，调用时把唯一 payload 透传给主进程。
// （...args 写法也可，但约定每方法至多一个对象，显式写 (payload) 意图更清晰。）
const createInvoke = (channel) => (payload) => ipcRenderer.invoke(channel, payload)

contextBridge.exposeInMainWorld('api', {
  auth: {
    login: createInvoke('auth:login'),
    logout: createInvoke('auth:logout'),
    getCurrentUser: createInvoke('auth:get-current-user'),
    changePassword: createInvoke('auth:change-password'),
    listUsers: createInvoke('auth:list-users'),
    createUser: createInvoke('auth:create-user'),
    updateUser: createInvoke('auth:update-user'),
    deleteUser: createInvoke('auth:delete-user')
  },
  sys: {
    info: createInvoke('sys:info'),
    dbInfo: createInvoke('sys:db-info'),
    dbConnections: createInvoke('sys:db-connections'),
    switchDb: createInvoke('sys:switch-db'),
    addDb: createInvoke('sys:add-db'),
    deleteDb: createInvoke('sys:delete-db')
  }
})
