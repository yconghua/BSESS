/**
 * useWorkspace —— 全局共享的仿真工作台状态（模块级单例）。
 *
 * 16 个功能页面（场景/仿真/分析/对比）共享同一份：
 *   场景状态（rows/cols/cells/exits/agents）、算法、最近一次仿真结果（stats/paths/distanceField）、
 *   动画状态（进度/暂停）、热力图与路径线开关。
 * 任何页面挂载 GridCanvas 后调用 mountCanvas() 即接管 3D 场景渲染。
 */
import { reactive, ref } from 'vue'
import { useSimulation } from './useSimulation'

const state = reactive({
  // 场景
  rows: 20,
  cols: 30,
  cells: [],
  exits: [],
  agents: [],
  mode: 'obstacle', // obstacle | exit | agent | erase
  algorithm: 'distanceField',
  // 最近一次仿真结果
  result: null, // { agentPaths, stats, distanceField, computationTime }
  // 显示层
  heatmapOn: false,
  pathLinesOn: false,
  // 动画 / HUD
  evacActive: false,
  evacStep: 0,
  evacTotal: 0,
  evacDone: 0,
  paused: false,
  speed: 200, // 每步毫秒
  // 通用
  loading: false,
  error: ''
})

const canvasRef = ref(null) // 当前页面挂载的 GridCanvas 实例
const notice = ref('')
const noticeErr = ref(false)
let noticeTimer = 0

function showNotice(msg, isErr = false) {
  notice.value = msg
  noticeErr.value = isErr
  clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => (notice.value = ''), 3000)
}

// 仿真通信（复用 useSimulation 的连接/算法/请求封装）
const { loading: simLoading, error: simError, algorithms, initBackendUrl, fetchAlgorithms, runSimulation } = useSimulation()

/** 页面挂载场景画布时调用：接管渲染并应用当前状态 */
function mountCanvas(gridRef) {
  canvasRef.value = gridRef
  renderScene()
}

function unmountCanvas() {
  canvasRef.value = null
}

/** 把当前场景状态整份渲染到 3D 场景（含热力图/路径线叠加） */
function renderScene() {
  const g = canvasRef.value
  if (!g) return
  g.renderGrid({ rows: state.rows, cols: state.cols, cells: state.cells, exits: state.exits, agents: state.agents })
  if (state.heatmapOn && state.result?.distanceField) g.setHeatmap(state.result.distanceField)
  if (state.pathLinesOn && state.result?.agentPaths) g.renderPaths(state.result.agentPaths)
}

/** 生成新网格（全空地） */
function generate(rows, cols) {
  state.rows = rows
  state.cols = cols
  state.cells = Array.from({ length: rows }, () => Array(cols).fill(0))
  state.exits = []
  state.agents = []
  resetResult()
  renderScene()
}

/** 点格子涂绘（按当前 mode） */
function onCellClick({ row, col }) {
  const cell = state.cells[row]?.[col]
  if (cell === undefined) return
  if (state.mode === 'obstacle') {
    if (cell === 1) return
    state.cells[row][col] = 1
    state.exits = state.exits.filter((e) => !(e.row === row && e.col === col))
    state.agents = state.agents.filter((a) => !(a.row === row && a.col === col))
  } else if (state.mode === 'exit') {
    if (cell === 1) return
    state.exits = state.exits.some((e) => e.row === row && e.col === col)
      ? state.exits.filter((e) => !(e.row === row && e.col === col))
      : [...state.exits, { row, col }]
    state.agents = state.agents.filter((a) => !(a.row === row && a.col === col))
  } else if (state.mode === 'agent') {
    if (cell === 1 || state.exits.some((e) => e.row === row && e.col === col)) return
    state.agents = state.agents.some((a) => a.row === row && a.col === col)
      ? state.agents.filter((a) => !(a.row === row && a.col === col))
      : [...state.agents, { row, col }]
  } else if (state.mode === 'erase') {
    state.cells[row][col] = 0
    state.exits = state.exits.filter((e) => !(e.row === row && e.col === col))
    state.agents = state.agents.filter((a) => !(a.row === row && a.col === col))
  }
  // 地形/出口变化会让旧结果失效，仅人员变化时保留
  if (state.mode !== 'agent') resetResult()
  renderScene()
}

/** 随机生成 N 人：只落在空地且不与出口/已有人员重叠 */
function randomAgents(n) {
  const free = []
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      if (state.cells[r][c] === 1) continue
      if (state.exits.some((e) => e.row === r && e.col === c)) continue
      if (state.agents.some((a) => a.row === r && a.col === c)) continue
      free.push({ row: r, col: c })
    }
  }
  for (let i = free.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[free[i], free[j]] = [free[j], free[i]]
  }
  state.agents = [...state.agents, ...free.slice(0, Math.min(n, free.length))]
  resetResult()
  renderScene()
}

function clearAgents() {
  state.agents = []
  resetResult()
  renderScene()
}

function clearObstacles() {
  state.cells = state.cells.map((row) => row.map(() => 0))
  resetResult()
  renderScene()
}

/** 应用一个场景（加载/导入时） */
function applyScene(scene) {
  const g = scene.gridData || {}
  state.rows = g.rows || 20
  state.cols = g.cols || 30
  state.cells = Array.isArray(g.cells) && g.cells.length
    ? g.cells.map((r) => [...r])
    : Array.from({ length: state.rows }, () => Array(state.cols).fill(0))
  state.exits = (scene.exits || []).map((e) => ({ row: e.row, col: e.col }))
  state.agents = (scene.agents || []).map((a) => ({ row: a.row, col: a.col }))
  if (scene.settings?.algorithm) state.algorithm = scene.settings.algorithm
  resetResult()
  renderScene()
}

/** 清理最近一次仿真结果（场景变化后调用） */
function resetResult() {
  state.result = null
  state.heatmapOn = false
  state.pathLinesOn = false
  state.evacActive = false
  state.evacStep = 0
  state.evacTotal = 0
  state.evacDone = 0
  state.paused = false
  canvasRef.value?.clearHeatmap?.()
  canvasRef.value?.clearPaths?.()
}

/** 运行疏散：请求后端 → 播放动画 → 更新 HUD（Electron 环境自动写记录） */
async function run() {
  if (!state.exits.length) {
    showNotice('请先标记至少一个出口（场景 → 出口标记）', true)
    return false
  }
  if (!state.agents.length) {
    showNotice('请先布置人员（场景 → 人员设定）', true)
    return false
  }
  try {
    const data = await runSimulation({
      grid: state.cells,
      exits: state.exits,
      agents: state.agents,
      algorithm: state.algorithm
    })
    state.result = data
    state.evacActive = true
    state.evacStep = 0
    state.evacTotal = data.agentPaths.reduce((m, p) => Math.max(m, p.length ? p.length - 1 : 0), 0)
    state.evacDone = 0
    state.paused = false
    const g = canvasRef.value
    g?.playPaths(data.agentPaths, {
      stepMs: state.speed,
      onStep: (step, done, total) => {
        state.evacStep = step
        state.evacTotal = total
        state.evacDone = done
      },
      onFinish: () => {
        state.evacDone = state.agents.length - data.stats.unreachableCount
        state.evacActive = false
      }
    })
    if (state.heatmapOn) g?.setHeatmap(data.distanceField)
    if (state.pathLinesOn) g?.renderPaths(data.agentPaths)
    saveRecord(data)
    return true
  } catch {
    return false
  }
}

/** 仿真结果落库（Electron 环境；浏览器模式跳过） */
async function saveRecord(data) {
  if (!window.api?.simRecord?.save) return
  try {
    await window.api.simRecord.save({
      algorithm: state.algorithm,
      stats: data.stats,
      paths: data.agentPaths,
      computationTimeMs: data.computationTime
    })
  } catch {
    // 记录失败不影响主流程
  }
}

/** 重置：停动画 + 清结果 */
function reset() {
  canvasRef.value?.stopPaths?.()
  resetResult()
  renderScene()
}

function pause() {
  state.paused = true
  canvasRef.value?.pausePaths?.()
}

function resume() {
  state.paused = false
  canvasRef.value?.resumePaths?.()
}

function stop() {
  canvasRef.value?.stopPaths?.()
  state.evacActive = false
  state.paused = false
}

function setSpeed(ms) {
  state.speed = ms
}

function toggleHeatmap() {
  if (!state.heatmapOn && !state.result?.distanceField) {
    showNotice('请先运行一次仿真，拿到距离场数据后再叠加（仿真 → 疏散运行）', true)
    return
  }
  state.heatmapOn = !state.heatmapOn
  const g = canvasRef.value
  if (state.heatmapOn) g?.setHeatmap(state.result.distanceField)
  else g?.clearHeatmap()
}

function togglePathLines() {
  if (!state.pathLinesOn && !state.result?.agentPaths) {
    showNotice('请先运行一次仿真，再查看路径线条', true)
    return
  }
  state.pathLinesOn = !state.pathLinesOn
  const g = canvasRef.value
  if (state.pathLinesOn) g?.renderPaths(state.result.agentPaths)
  else g?.clearPaths()
}

function initBackend() {
  return initBackendUrl().then(fetchAlgorithms)
}

export function useWorkspace() {
  return {
    state, notice, noticeErr, showNotice,
    algorithms, loading: simLoading, error: simError,
    initBackend, fetchAlgorithms, runSimulation,
    mountCanvas, unmountCanvas, renderScene,
    generate, onCellClick, randomAgents, clearAgents, clearObstacles, applyScene,
    run, reset, pause, resume, stop, setSpeed,
    toggleHeatmap, togglePathLines
  }
}
