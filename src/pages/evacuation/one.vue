<template>
  <div class="page">
    <div class="page-header">
      <h2 class="page-title">疏散仿真</h2>
      <span class="page-sub">画空间 → 选算法 → 开始疏散（后端 /simulate 计算，3D 动画播放）</span>
    </div>
    <div class="main">
      <aside class="side">
        <ControlPanel
          :rows="rows"
          :cols="cols"
          :mode="mode"
          :algorithm="algorithm"
          :algorithms="algorithms"
          :agents-count="agents.length"
          :exits-count="exits.length"
          :obstacles-count="obstacleCount"
          :stats="stats"
          :loading="loading"
          :error="error"
          :result-ms="resultMs"
          @generate="onGenerate"
          @update:mode="onModeChange"
          @update:algorithm="algorithm = $event"
          @random-agents="onRandomAgents"
          @clear-agents="onClearAgents"
          @clear-obstacles="onClearObstacles"
          @start="onStart"
          @reset="onReset"
        />
      </aside>
      <div class="scene-wrap">
        <GridCanvas ref="gridRef" @cell-click="onCellClick" />
        <div class="legend">
          <span><i class="dot" style="background:#555b66"></i>障碍</span>
          <span><i class="dot" style="background:#2ecc71"></i>出口</span>
          <span><i class="dot" style="background:#3498db"></i>人员</span>
          <span class="hint">左键旋转 / 右键平移 / 滚轮缩放</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * 疏散仿真页（M0 编排器）：持有场景状态，连接 控制面板 ↔ 3D 场景 ↔ 后端。
 * 状态：cells 只存地形 0/1；exits / agents 为独立叠加层。
 */
import { computed, onMounted, ref } from 'vue'
import GridCanvas from '@/components/evacuation/GridCanvas.vue'
import ControlPanel from '@/components/evacuation/ControlPanel.vue'
import { useSimulation } from '@/composables/useSimulation'

const gridRef = ref(null)
const { loading, error, result, algorithms, initBackendUrl, fetchAlgorithms, runSimulation } = useSimulation()

// 场景状态
const rows = ref(20)
const cols = ref(30)
const cells = ref([])       // number[][]
const exits = ref([])       // {row, col}[]
const agents = ref([])      // {row, col}[]
const mode = ref('obstacle')
const algorithm = ref('distanceField')
const stats = ref(null)
const resultMs = ref(0)

const obstacleCount = computed(() => cells.value.flat().filter((v) => v === 1).length)

/** 把当前状态整份推给 3D 场景渲染 */
function renderScene() {
  gridRef.value?.renderGrid({ rows: rows.value, cols: cols.value, cells: cells.value, exits: exits.value, agents: agents.value })
}

/** 生成新网格（全空地） */
function onGenerate({ rows: r, cols: c }) {
  rows.value = r
  cols.value = c
  cells.value = Array.from({ length: r }, () => Array(c).fill(0))
  exits.value = []
  agents.value = []
  stats.value = null
  error.value = ''
  renderScene()
}

/** 点格子涂绘：按当前模式修改状态后重渲染 */
function onCellClick({ row, col }) {
  const cell = cells.value[row]?.[col]
  if (cell === undefined) return
  if (mode.value === 'obstacle') {
    if (cell === 1) return
    cells.value[row][col] = 1
    exits.value = exits.value.filter((e) => !(e.row === row && e.col === col))
    agents.value = agents.value.filter((a) => !(a.row === row && a.col === col))
  } else if (mode.value === 'exit') {
    if (cell === 1) return
    exits.value = exits.value.some((e) => e.row === row && e.col === col)
      ? exits.value.filter((e) => !(e.row === row && e.col === col)) // 再点一次取消
      : [...exits.value, { row, col }]
    agents.value = agents.value.filter((a) => !(a.row === row && a.col === col))
  } else if (mode.value === 'agent') {
    if (cell === 1 || exits.value.some((e) => e.row === row && e.col === col)) return
    agents.value = agents.value.some((a) => a.row === row && a.col === col)
      ? agents.value.filter((a) => !(a.row === row && a.col === col))
      : [...agents.value, { row, col }]
  } else if (mode.value === 'erase') {
    cells.value[row][col] = 0
    exits.value = exits.value.filter((e) => !(e.row === row && e.col === col))
    agents.value = agents.value.filter((a) => !(a.row === row && a.col === col))
  }
  renderScene()
}

/** 随机生成 N 人：只落在空地且不与出口/已有人员重叠 */
function onRandomAgents(n) {
  const free = []
  for (let r = 0; r < rows.value; r++) {
    for (let c = 0; c < cols.value; c++) {
      if (cells.value[r][c] === 1) continue
      if (exits.value.some((e) => e.row === r && e.col === c)) continue
      if (agents.value.some((a) => a.row === r && a.col === c)) continue
      free.push({ row: r, col: c })
    }
  }
  // Fisher-Yates 洗牌后取前 n 个
  for (let i = free.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[free[i], free[j]] = [free[j], free[i]]
  }
  agents.value = [...agents.value, ...free.slice(0, Math.min(n, free.length))]
  renderScene()
}

function onClearAgents() {
  agents.value = []
  stats.value = null
  renderScene()
}

function onClearObstacles() {
  cells.value = cells.value.map((row) => row.map(() => 0))
  stats.value = null
  renderScene()
}

/** 开始疏散：请求后端 → 播放路径动画 → 展示统计 */
async function onStart(speed) {
  if (!exits.value.length) {
    error.value = '请先放置至少一个出口（切换到「出口」模式点击格子）'
    return
  }
  if (!agents.value.length) {
    error.value = '请先布置人员（点击格子或使用随机生成）'
    return
  }
  try {
    const data = await runSimulation({
      grid: cells.value,
      exits: exits.value,
      agents: agents.value,
      algorithm: algorithm.value
    })
    stats.value = data.stats
    resultMs.value = data.computationTime
    gridRef.value?.playPaths(data.agentPaths, { stepMs: speed })
  } catch {
    // 错误信息已由 useSimulation 写入 error
  }
}

/** 重置：停动画 + 恢复初始位置 + 清统计 */
function onReset() {
  gridRef.value?.stopPaths()
  stats.value = null
  resultMs.value = 0
  renderScene()
}

function onModeChange(m) {
  mode.value = m
  // 切换绘制模式后清掉旧错误（如「未设置出口」的提示）
  if (m === 'exit' || m === 'agent') error.value = ''
}

// 挂载：先取主进程分配的后端地址（Electron 下），再拉算法列表；预置示例场景便于立即演示
onMounted(async () => {
  await initBackendUrl()
  fetchAlgorithms()
  buildSampleScene()
})

/** 内置示例：20×30，中间横墙留缺口 + 上下区障碍 + 2 出口 + 10 人 */
function buildSampleScene() {
  const R = 20
  const C = 30
  const g = Array.from({ length: R }, () => Array(C).fill(0))
  for (let c = 0; c < C; c++) {
    if (c < 12 || c > 17) g[10][c] = 1
  }
  for (const [r, c] of [[3, 8], [4, 8], [3, 9], [6, 20], [6, 21], [15, 6], [15, 7], [16, 22], [16, 23]]) {
    g[r][c] = 1
  }
  rows.value = R
  cols.value = C
  cells.value = g
  exits.value = [
    { row: 0, col: 14 },
    { row: 19, col: 14 }
  ]
  agents.value = [
    { row: 3, col: 3 }, { row: 5, col: 15 }, { row: 7, col: 26 },
    { row: 2, col: 20 }, { row: 4, col: 12 }, { row: 13, col: 4 },
    { row: 15, col: 13 }, { row: 17, col: 24 }, { row: 12, col: 27 },
    { row: 18, col: 8 }
  ]
  renderScene()
}
</script>

<style scoped>
.page {
  min-height: 100%;
  display: flex;
  flex-direction: column;
}
.page-header {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 12px;
}
.page-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
}
.page-sub {
  font-size: 12px;
  color: #8a9099;
}
.main {
  flex: 1;
  display: flex;
  gap: 14px;
  min-height: 0;
}
.side {
  width: 260px;
  flex-shrink: 0;
  overflow-y: auto;
}
.scene-wrap {
  flex: 1;
  position: relative;
  min-width: 0;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid #e6e9ef;
  background: #f5f6f9;
}
.legend {
  position: absolute;
  left: 12px;
  bottom: 12px;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid #e6e9ef;
  border-radius: 8px;
  font-size: 12px;
  color: #3a3f47;
}
.legend .hint {
  color: #8a9099;
  margin-left: 6px;
}
.dot {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  display: inline-block;
  margin-right: 4px;
}
</style>
