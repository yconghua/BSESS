/**
 * backendService —— Python FastAPI 计算服务的进程管理（sidecar 生命周期）。
 *
 * 职责（与设计文档「六、进程生命周期」对齐）：
 *   1. 解析 Python 启动方式：开发期用项目根目录 .venv 的 python；打包期用 PyInstaller 产物（M4）；
 *   2. 选择端口：首选 8000，若已被占用则向系统申请随机空闲端口；
 *   3. 若 8000 上已有一个健康的 BSESS 服务（如开发期手动起的 uvicorn），直接复用、不再重复拉起；
 *   4. spawn uvicorn 后轮询 GET /health 直至就绪（超时 30s）；
 *   5. 退出时（app 退出 / 显式 stop）杀掉子进程树，不留孤儿进程。
 *
 * 注意：本模块顶层不 require('electron')（便于用纯 Node 做集成测试），
 * 打包态判断通过惰性 require 获取。
 */
const { spawn } = require('node:child_process')
const http = require('node:http')
const net = require('node:net')
const path = require('node:path')
const fs = require('node:fs')

const { BACKEND_HOST, BACKEND_HEALTH_TIMEOUT_MS, BACKEND_HEALTH_INTERVAL_MS, BACKEND_PORT: SHARED_BACKEND_PORT } = require('../../shared/constants')

// 首选端口：默认 8000；支持 BSESS_BACKEND_PORT 环境变量覆盖（测试 / 特殊部署用）
const BACKEND_PORT = Number(process.env.BSESS_BACKEND_PORT) || SHARED_BACKEND_PORT

// 项目根目录 = electron/ 的上一级（开发期 .venv 与 app/ 都在根目录）
const PROJECT_ROOT = path.join(__dirname, '..', '..')

// 惰性获取 electron：纯 Node 测试环境下没有该模块，返回 null
function getApp() {
  try {
    return require('electron').app
  } catch {
    return null
  }
}

const isPackaged = () => (getApp() ? getApp().isPackaged : false)

/** 解析启动 Python 的路径（打包态为 sidecar 可执行文件，M4 落位） */
function resolvePython() {
  if (isPackaged()) {
    // 打包期：PyInstaller 产物置于 resources/backend/ 下（M4 实现，先给出约定路径）
    const exe = path.join(process.resourcesPath || '', 'backend', process.platform === 'win32' ? 'bsess-backend.exe' : 'bsess-backend')
    return fs.existsSync(exe) ? exe : null
  }
  // 开发期：优先项目根目录 .venv
  const venvPy = process.platform === 'win32'
    ? path.join(PROJECT_ROOT, '.venv', 'Scripts', 'python.exe')
    : path.join(PROJECT_ROOT, '.venv', 'bin', 'python')
  if (fs.existsSync(venvPy)) return venvPy
  // 兜底：PATH 上的 python
  return 'python'
}

/** 探测某个端口上是否已有健康的 BSESS 服务（短超时，1.2s） */
function probeHealth(port, timeoutMs = 1200) {
  return new Promise((resolve) => {
    const req = http.get({ host: BACKEND_HOST, port, path: '/health', timeout: timeoutMs }, (res) => {
      res.resume()
      const ok = res.statusCode === 200
      res.on('end', () => resolve(ok))
    })
    req.on('timeout', () => {
      req.destroy()
      resolve(false)
    })
    req.on('error', () => resolve(false))
  })
}

/** 申请空闲端口：优先 preferred，被占用则退回系统随机分配 */
function findFreePort(preferred) {
  return new Promise((resolve, reject) => {
    const tryListen = (port) => {
      const srv = net.createServer()
      srv.once('error', (err) => {
        if (port === preferred) return tryListen(0) // 首选被占 → 随机空闲端口
        reject(err)
      })
      srv.listen(port, BACKEND_HOST, () => {
        const { port: actual } = srv.address()
        srv.close(() => resolve(actual))
      })
    }
    tryListen(preferred)
  })
}

/** 轮询健康检查直至就绪（设计文档：超时 30 秒） */
async function waitHealthy(port, url) {
  const deadline = Date.now() + BACKEND_HEALTH_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (await probeHealth(port, 1000)) return true
    await new Promise((r) => setTimeout(r, BACKEND_HEALTH_INTERVAL_MS))
  }
  return false
}

// ---------------------------------------------------------------------------
// 服务状态机：stopped → starting → running | error → stopped
// ---------------------------------------------------------------------------
const state = {
  status: 'stopped', // stopped | starting | running | error
  port: null,
  url: null,
  child: null, // 本模块拉起的子进程；复用时为 null（不归我们管理）
  adopted: false, // true 表示复用了外部已运行的实例
  error: ''
}

let statusListener = null

function emitStatus() {
  statusListener?.(getStatus())
}

function setStatus(patch) {
  Object.assign(state, patch)
  emitStatus()
}

/** 获取当前状态（渲染层「后端连接状态」展示用） */
function getStatus() {
  return {
    status: state.status,
    port: state.port,
    url: state.url,
    adopted: state.adopted,
    error: state.error
  }
}

/** 订阅状态变化（IPC 层用来广播给渲染层） */
function onStatusChange(fn) {
  statusListener = fn
}

/** 启动计算服务（幂等：已 running 直接返回；8000 已有健康实例则复用） */
async function start() {
  if (state.status === 'running' || state.status === 'starting') return getStatus()

  setStatus({ status: 'starting', error: '' })

  // 1) 首选端口上已有健康实例？直接复用（避免和开发期手动 uvicorn 双开）
  if (await probeHealth(BACKEND_PORT)) {
    setStatus({ status: 'running', port: BACKEND_PORT, url: `http://${BACKEND_HOST}:${BACKEND_PORT}`, adopted: true })
    return getStatus()
  }

  // 2) 找空闲端口 + 解析 Python
  const port = await findFreePort(BACKEND_PORT)
  const python = resolvePython()
  if (!python) {
    setStatus({ status: 'error', error: '打包模式下未找到 backend 可执行文件（M4 落位）' })
    return getStatus()
  }

  // 3) spawn uvicorn（cwd 必须是项目根目录，app 包在根目录）
  const args = ['-m', 'uvicorn', 'app.main:app', '--host', BACKEND_HOST, '--port', String(port)]
  const child = spawn(python, args, {
    cwd: PROJECT_ROOT,
    env: { ...process.env, PYTHONUNBUFFERED: '1' },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  })
  state.child = child

  // 日志只透传到主进程控制台，限制长度防止刷屏
  const buffer = { out: '', err: '' }
  child.stdout?.on('data', (d) => {
    buffer.out = (buffer.out + d).slice(-2000)
    console.log(`[backend] ${d.toString().trim()}`)
  })
  child.stderr?.on('data', (d) => {
    buffer.err = (buffer.err + d).slice(-2000)
    console.error(`[backend] ${d.toString().trim()}`)
  })

  // 4) 轮询健康检查
  const url = `http://${BACKEND_HOST}:${port}`
  const ready = await waitHealthy(port, url)
  if (!ready) {
    child.kill()
    state.child = null
    setStatus({ status: 'error', error: `后端启动超时（${BACKEND_HEALTH_TIMEOUT_MS / 1000}s 内未就绪）` })
    return getStatus()
  }

  setStatus({ status: 'running', port, url, adopted: false })

  // 运行中意外退出 → 置 error 并广播（前端可提示重启）
  child.on('exit', (code, signal) => {
    if (state.status === 'running') {
      setStatus({ status: 'error', error: `后端进程意外退出（code=${code} signal=${signal}）` })
    }
    state.child = null
  })

  return getStatus()
}

/** 停止计算服务：杀掉子进程树（Windows 用 taskkill /T 保证 uvicorn 及其子进程不留孤儿） */
function stop() {
  const child = state.child
  state.child = null
  if (child && !child.killed) {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true })
    } else {
      child.kill('SIGTERM')
    }
  }
  setStatus({ status: 'stopped', port: null, url: null, adopted: false })
}

module.exports = { start, stop, getStatus, onStatusChange, isPackaged }
