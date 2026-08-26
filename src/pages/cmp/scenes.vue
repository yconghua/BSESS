<template>
  <FunctionPage title="场景对比" sub="不同障碍布局 / 出口位置的疏散效果横向比较">
    <template #actions>
      <button class="fp-btn primary" :disabled="running || selected.length < 2" @click="runCompare">
        {{ running ? `运行中 ${progress}` : '开始对比' }}
      </button>
      <button class="fp-btn" :disabled="!rows.length" @click="exportCsv">导出 CSV</button>
    </template>

    <template #side>
      <div class="fp-card">
        <h3 class="fp-card-title">选择场景（至少 2 个）</h3>
        <label class="check-row">
          <input v-model="selected" type="checkbox" value="__current" />
          <span>当前工作台场景（{{ s.rows }}×{{ s.cols }}）</span>
        </label>
        <label v-for="sc in savedScenarios" :key="sc.id" class="check-row">
          <input v-model="selected" type="checkbox" :value="sc.id" />
          <span>{{ sc.name }}（{{ sc.gridData.rows }}×{{ sc.gridData.cols }}）</span>
        </label>
        <p class="fp-hint" :class="{ err: !hasApi }">
          {{ hasApi ? `已选 ${selected.length} 个场景` : '保存的场景需在 Electron 桌面端读取；浏览器模式仅可用当前工作台场景' }}
        </p>
        <div class="fp-row" style="margin-top:8px">
          <span class="fp-label">算法</span>
          <select v-model="algorithm" class="fp-select">
            <option v-for="a in algorithms" :key="a.id" :value="a.id">{{ a.label }}</option>
          </select>
        </div>
      </div>
    </template>

    <div v-if="!rows.length && !running" class="empty-card">
      <p class="fp-hint">勾选至少两个场景（含当前工作台），选择算法后点「开始对比」。结果按总步数升序，便于横向比较疏散效率。</p>
    </div>

    <div v-else class="fp-card">
      <h3 class="fp-card-title">对比结果（算法：{{ algoLabel }}）</h3>
      <table class="fp-table">
        <thead>
          <tr>
            <th>场景</th>
            <th>尺寸</th>
            <th>出口</th>
            <th>人数</th>
            <th>总步数</th>
            <th>平均路径</th>
            <th>不可达</th>
            <th>耗时(ms)</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.name">
            <td>{{ row.name }}</td>
            <td>{{ row.size }}</td>
            <td>{{ row.exitCount }}</td>
            <td>{{ row.agentCount }}</td>
            <td>{{ row.totalSteps }}</td>
            <td>{{ row.avgPathLength }}</td>
            <td :class="{ red: row.unreachableCount > 0 }">{{ row.unreachableCount }}</td>
            <td>{{ row.computationTime }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </FunctionPage>
</template>

<script setup>
// 对比 · 场景对比：多个场景 × 同一算法
import { computed, onMounted, ref } from 'vue'
import FunctionPage from '@/components/FunctionPage.vue'
import { useWorkspace } from '@/composables/useWorkspace'

const ws = useWorkspace()
const s = ws.state
const algorithms = ws.algorithms
const hasApi = !!window.api?.scenario
const savedScenarios = ref([])
const selected = ref([])
const algorithm = ref('distanceField')
const rows = ref([])
const running = ref(false)
const progress = ref('')

const algoLabel = computed(() => algorithms.value.find((a) => a.id === algorithm.value)?.label || algorithm.value)

async function loadScenarios() {
  if (!hasApi) return
  try {
    const res = await window.api.scenario.list()
    if (res?.success) savedScenarios.value = res.scenarios || []
  } catch {
    // 忽略
  }
}

function getScene(id) {
  if (id === '__current') {
    return {
      name: `当前工作台 ${s.rows}×${s.cols}`,
      gridData: { rows: s.rows, cols: s.cols, cells: s.cells },
      exits: s.exits,
      agents: s.agents
    }
  }
  return savedScenarios.value.find((sc) => String(sc.id) === String(id))
}

async function runCompare() {
  running.value = true
  rows.value = []
  try {
    const scenes = selected.value.map(getScene).filter(Boolean)
    for (let i = 0; i < scenes.length; i++) {
      const sc = scenes[i]
      progress.value = `${sc.name}（${i + 1}/${scenes.length}）`
      const g = sc.gridData
      try {
        const data = await ws.runSimulation({
          grid: g.cells,
          exits: sc.exits,
          agents: sc.agents,
          algorithm: algorithm.value
        })
        rows.value.push({
          name: sc.name,
          size: `${g.rows}×${g.cols}`,
          exitCount: sc.exits.length,
          agentCount: sc.agents.length,
          totalSteps: data.stats.totalSteps,
          avgPathLength: data.stats.avgPathLength,
          maxPathLength: data.stats.maxPathLength,
          unreachableCount: data.stats.unreachableCount,
          computationTime: data.computationTime
        })
      } catch {
        rows.value.push({ name: sc.name, size: '-', exitCount: '-', agentCount: '-', totalSteps: '-', avgPathLength: '-', maxPathLength: '-', unreachableCount: '-', computationTime: '-' })
      }
    }
    rows.value.sort((a, b) => (typeof a.totalSteps === 'number' ? a.totalSteps : 1e9) - (typeof b.totalSteps === 'number' ? b.totalSteps : 1e9))
  } finally {
    running.value = false
    progress.value = ''
  }
}

function exportCsv() {
  const head = '场景,尺寸,出口,人数,总步数,平均路径,不可达,耗时(ms)\n'
  const lines = rows.value.map((r) => `${r.name},${r.size},${r.exitCount},${r.agentCount},${r.totalSteps},${r.avgPathLength},${r.unreachableCount},${r.computationTime}`)
  const blob = new Blob(['\uFEFF' + head + lines.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `bsess_scene_cmp_${Date.now()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

onMounted(() => {
  ws.initBackend()
  loadScenarios()
})
</script>

<style scoped>
.empty-card {
  background: #fff;
  border-radius: 10px;
  padding: 48px 24px;
  text-align: center;
}
.check-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #4e5969;
  padding: 5px 0;
  cursor: pointer;
}
.red {
  color: #a32d2d;
  font-weight: 600;
}
</style>
