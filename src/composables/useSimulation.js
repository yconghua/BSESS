/**
 * useSimulation —— 封装后端计算服务的 HTTP 通信。
 *
 * 职责：
 *   1. 解析后端地址：Electron 环境经 window.api.backend.status() 获取主进程实际拉起的端口；
 *      纯浏览器开发环境回退 http://127.0.0.1:8000；
 *   2. GET  /algorithms 拉取可用算法列表（失败时回退内置清单，保证离线可演示）；
 *   3. POST /simulate   执行疏散计算，返回 { agentPaths, stats, distanceField, computationTime }。
 */
import { ref } from 'vue'

export const BACKEND_HOST = '127.0.0.1'
export const FALLBACK_PORT = 8000

// 后端不可达时的回退算法清单（与后端 ALGORITHM_CATALOG 保持一致）
const FALLBACK_ALGORITHMS = [
  { id: 'distanceField', label: '多源距离场', recommended: true, scenario: '多出口 / 大网格', description: '多源 BFS 一次计算，v1 默认推荐' },
  { id: 'dijkstra', label: 'Dijkstra', recommended: false, scenario: '有权图 / 教学对照', description: '优先队列版本，等权下与距离场一致' },
  { id: 'astar', label: 'A*', recommended: false, scenario: '单出口 / 大体量', description: '多目标 A*，启发式取最近出口曼哈顿距离' },
  { id: 'bfs', label: 'BFS', recommended: false, scenario: '无权图 / 教学演示', description: '单源 BFS 逐人搜索，固定 4 邻接' },
  { id: 'ca', label: 'CA 元胞自动机', recommended: false, scenario: '多智能体 / 拥堵演示', description: '每步距离场梯度 + 同格冲突消解，呈现排队与绕行' },
  { id: 'sfm', label: '社交力模型', recommended: false, scenario: '连续空间 / 密度研究', description: 'Helbing 社交力模型：期望力 + 障碍/人际排斥，连续坐标仿真' }
]

export function useSimulation() {
  const loading = ref(false)
  const error = ref('')
  const result = ref(null)
  const algorithms = ref([])
  // 后端实际地址：Electron 下由主进程分配（可能不是 8000），浏览器开发默认 8000
  const backendUrl = ref(`http://${BACKEND_HOST}:${FALLBACK_PORT}`)

  /** 从 Electron 主进程获取实际后端地址（纯浏览器环境自动跳过） */
  async function initBackendUrl() {
    try {
      const info = await window.api?.backend?.status?.()
      if (info?.success && info.url) backendUrl.value = info.url
    } catch {
      // 无 window.api（纯浏览器 dev），保持默认端口
    }
  }

  /** 拉取算法列表；失败（后端未启动）则用内置清单，并给出提示但不阻断 */
  async function fetchAlgorithms() {
    try {
      const res = await fetch(`${backendUrl.value}/algorithms`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      algorithms.value = data.algorithms?.length ? data.algorithms : FALLBACK_ALGORITHMS
    } catch {
      algorithms.value = FALLBACK_ALGORITHMS
      error.value = '后端服务未连接，已使用内置算法列表（请启动后端）'
    }
  }

  /** 执行疏散计算；成功返回结果对象，失败抛出带 message 的 Error（前端展示 code/message） */
  async function runSimulation({ grid, exits, agents, algorithm }) {
    loading.value = true
    error.value = ''
    try {
      const res = await fetch(`${backendUrl.value}/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grid, exits, agents, algorithm })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const code = data?.detail?.code || 'UNKNOWN'
        const message = data?.detail?.message || `请求失败（HTTP ${res.status}）`
        throw new Error(`${message}（${code}）`)
      }
      result.value = data
      return data
    } catch (e) {
      // 网络层失败与业务错误统一走 error 展示
      error.value = e instanceof TypeError ? '无法连接后端服务，请确认后端已启动' : e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  return { loading, error, result, algorithms, backendUrl, initBackendUrl, fetchAlgorithms, runSimulation }
}
