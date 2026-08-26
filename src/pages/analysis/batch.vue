<template>
  <div class="page">
    <div class="page-header">
      <h2 class="page-title">批量实验</h2>
      <span class="page-sub">同一场景 × 全部算法 依次跑一遍，输出对比表（可导出 CSV / JSON）</span>
    </div>

    <!-- 场景选择 -->
    <section class="card">
      <h3 class="card-title">选择场景</h3>
      <div class="row">
        <select v-model="selectedId" class="select" @change="onSceneChange">
          <option value="sample">内置示例（20×30）</option>
          <option v-for="s in scenarioList" :key="s.id" :value="s.id">{{ s.name }}（{{ s.gridData.rows }}×{{ s.gridData.cols }}）</option>
        </select>
      </div>
      <p class="hint" :class="{ err: !sceneReady }">{{ sceneDesc }}</p>
      <div class="row">
        <button class="btn primary" :disabled="!sceneReady || batchRunning" @click="runBatch">
          {{ batchRunning ? `运行中 ${batchProgress}` : '开始批量实验' }}
        </button>
        <button v-if="batchRows.length" class="btn" @click="exportCsv">导出 CSV</button>
        <button v-if="batchRows.length" class="btn" @click="exportJson">导出 JSON</button>
      </div>
    </section>

    <!-- 结果表 -->
    <section v-if="batchRows.length" class="card">
      <h3 class="card-title">对比结果</h3>
      <table class="cmp-table">
        <thead>
          <tr>
            <th>算法</th>
            <th>耗时(ms)</th>
            <th>总步数</th>
            <th>平均路径</th>
            <th>最长路径</th>
            <th>不可达</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in batchRows" :key="row.id">
            <td>{{ row.label }}</td>
            <td>{{ row.computationTime }}</td>
            <td>{{ row.totalSteps }}</td>
            <td>{{ row.avgPathLength }}</td>
            <td>{{ row.maxPathLength }}</td>
            <td :class="{ warn: row.unreachableCount > 0 }">{{ row.unreachableCount }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<script setup>
/**
 * 批量实验页（M3）：选择场景（内置示例 / 已保存场景）→ 全部算法依次跑 → 对比表。
 * 供论文对照组 / 教学演示使用；无 3D 渲染，纯计算 + 表格。
 */
import { computed, onMounted, ref } from 'vue'
import { useSimulation } from '@/composables/useSimulation'

const { algorithms, initBackendUrl, fetchAlgorithms, runSimulation } = useSimulation()

const scenarioList = ref([])
const selectedId = ref('sample')
const currentScene = ref(null) // { gridData, exits, agents }
const batchRows = ref([])
const batchRunning = ref(false)
const batchProgress = ref('')
const errMsg = ref('')

const sceneReady = computed(() => !!currentScene.value)
const sceneDesc = computed(() => {
  if (!currentScene.value) return errMsg.value || '场景不可用'
  const g = currentScene.value.gridData
  return `${g.rows}×${g.cols} 网格 · ${currentScene.value.exits.length} 出口 · ${currentScene.value.agents.length} 人员`
})

/** 内置示例：与疏散页一致（20×30 横墙 + 障碍 + 2 出口 + 10 人） */
function buildSample() {
  const R = 20
  const C = 30
  const cells = Array.from({ length: R }, () => Array(C).fill(0))
  for (let c = 0; c < C; c++) {
    if (c < 12 || c > 17) cells[10][c] = 1
  }
  for (const [r, c] of [[3, 8], [4, 8], [3, 9], [6, 20], [6, 21], [15, 6], [15, 7], [16, 22], [16, 23]]) {
    cells[r][c] = 1
  }
  return {
    gridData: { rows: R, cols: C, cells },
    exits: [{ row: 0, col: 14 }, { row: 19, col: 14 }],
    agents: [
      { row: 3, col: 3 }, { row: 5, col: 15 }, { row: 7, col: 26 },
      { row: 2, col: 20 }, { row: 4, col: 12 }, { row: 13, col: 4 },
      { row: 15, col: 13 }, { row: 17, col: 24 }, { row: 12, col: 27 },
      { row: 18, col: 8 }
    ]
  }
}

function onSceneChange() {
  batchRows.value = []
  if (selectedId.value === 'sample') {
    currentScene.value = buildSample()
    return
  }
  const s = scenarioList.value.find((x) => String(x.id) === String(selectedId.value))
  currentScene.value = s
    ? { gridData: s.gridData, exits: s.exits, agents: s.agents }
    : null
}

async function loadScenarios() {
  if (!window.api?.scenario) return
  try {
    const res = await window.api.scenario.list()
    if (res?.success) scenarioList.value = res.scenarios || []
  } catch {
    // 忽略：仅影响场景选择
  }
}

async function runBatch() {
  if (!currentScene.value) return
  batchRunning.value = true
  batchRows.value = []
  errMsg.value = ''
  try {
    const { gridData, exits, agents } = currentScene.value
    for (let i = 0; i < algorithms.value.length; i++) {
      const a = algorithms.value[i]
      batchProgress.value = `${a.label}（${i + 1}/${algorithms.value.length}）`
      try {
        const data = await runSimulation({ grid: gridData.cells, exits, agents, algorithm: a.id })
        batchRows.value.push({
          id: a.id,
          label: a.label,
          computationTime: data.computationTime,
          totalSteps: data.stats.totalSteps,
          avgPathLength: data.stats.avgPathLength,
          maxPathLength: data.stats.maxPathLength,
          unreachableCount: data.stats.unreachableCount
        })
      } catch {
        batchRows.value.push({ id: a.id, label: a.label, computationTime: '-', totalSteps: '-', avgPathLength: '-', maxPathLength: '-', unreachableCount: '-' })
      }
    }
  } finally {
    batchRunning.value = false
    batchProgress.value = ''
  }
}

function exportCsv() {
  const head = '算法,耗时(ms),总步数,平均路径,最长路径,不可达\n'
  const lines = batchRows.value.map((r) => `${r.label},${r.computationTime},${r.totalSteps},${r.avgPathLength},${r.maxPathLength},${r.unreachableCount}`)
  download(`bsess_batch_${Date.now()}.csv`, '\uFEFF' + head + lines.join('\n'), 'text/csv')
}

function exportJson() {
  download(
    `bsess_batch_${Date.now()}.json`,
    JSON.stringify({ scene: selectedId.value, exportedAt: new Date().toISOString(), results: batchRows.value }, null, 2),
    'application/json'
  )
}

function download(name, content, type) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

onMounted(async () => {
  await initBackendUrl()
  fetchAlgorithms()
  loadScenarios()
  onSceneChange() // 默认加载内置示例
})
</script>

<style scoped>
.page {
  min-height: 100%;
}
.page-header {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 16px;
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
.card {
  background: #fff;
  border-radius: 10px;
  padding: 20px 24px;
  margin-bottom: 14px;
}
.card-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 14px;
}
.row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.row:last-child {
  margin-bottom: 0;
}
.select {
  min-width: 260px;
  padding: 6px 8px;
  border: 1px solid #d4d9e0;
  border-radius: 6px;
  font-size: 13px;
  background: #fff;
}
.btn {
  padding: 6px 14px;
  border: 1px solid #d4d9e0;
  border-radius: 8px;
  background: #fff;
  font-size: 13px;
  cursor: pointer;
}
.btn.primary {
  background: #185fa5;
  border-color: #185fa5;
  color: #fff;
}
.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.hint {
  font-size: 12px;
  color: #8a9099;
  margin: 0 0 10px;
}
.hint.err {
  color: #a32d2d;
}
.cmp-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.cmp-table th,
.cmp-table td {
  text-align: left;
  padding: 8px 12px;
  border-bottom: 1px solid #eceff3;
}
.cmp-table th {
  color: #6a7078;
  font-weight: 600;
  background: #f7f8fa;
}
.warn {
  color: #a32d2d;
  font-weight: 600;
}
</style>
