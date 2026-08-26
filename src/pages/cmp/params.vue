<template>
  <FunctionPage title="参数对比" sub="人员密度 / 网格尺寸 / 出口数量对疏散效率的影响分析">
    <template #actions>
      <button class="fp-btn primary" :disabled="running" @click="runSweep">
        {{ running ? `运行中 ${progress}` : '开始分析' }}
      </button>
      <button class="fp-btn" :disabled="!points.length" @click="exportCsv">导出 CSV</button>
    </template>

    <template #side>
      <div class="fp-card">
        <h3 class="fp-card-title">参数设置</h3>
        <div class="fp-row">
          <span class="fp-label" style="width:60px">参数</span>
          <select v-model="param" class="fp-select">
            <option value="density">人员密度</option>
            <option value="size">网格尺寸</option>
            <option value="exits">出口数量</option>
          </select>
        </div>
        <div class="fp-row">
          <span class="fp-label" style="width:60px">算法</span>
          <select v-model="algorithm" class="fp-select">
            <option v-for="a in algorithms" :key="a.id" :value="a.id">{{ a.label }}</option>
          </select>
        </div>
        <p class="fp-hint">{{ paramHint }}</p>
      </div>
    </template>

    <div v-if="!points.length && !running" class="empty-card">
      <p class="fp-hint">配置参数后点击「开始分析」。系统会自动生成一组场景（基准 20×20，出口在边界，人员随机分布），
        对每个参数档位运行一次疏散并汇总 makespan / 平均路径 / 不可达。</p>
    </div>

    <template v-else>
      <div class="fp-card">
        <h3 class="fp-card-title">{{ paramLabel }} → 疏散效率（算法：{{ algoLabel }}）</h3>
        <table class="fp-table">
          <thead>
            <tr>
              <th>{{ paramLabel }}</th>
              <th>总步数</th>
              <th>平均路径</th>
              <th>不可达</th>
              <th>耗时(ms)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in points" :key="p.x">
              <td>{{ p.x }}</td>
              <td>{{ p.totalSteps }}</td>
              <td>{{ p.avgPathLength }}</td>
              <td :class="{ red: p.unreachableCount > 0 }">{{ p.unreachableCount }}</td>
              <td>{{ p.computationTime }}</td>
            </tr>
          </tbody>
        </table>
        <p class="fp-hint" style="margin-top:10px">直观结论：总步数（makespan）随密度上升 / 出口增多而下降；平均路径反映人群分流效率。</p>
      </div>
    </template>
  </FunctionPage>
</template>

<script setup>
// 对比 · 参数对比：密度 / 网格尺寸 / 出口数量 单因素扫描
import { computed, onMounted, ref } from 'vue'
import FunctionPage from '@/components/FunctionPage.vue'
import { useWorkspace } from '@/composables/useWorkspace'

const ws = useWorkspace()
const algorithms = ws.algorithms
const param = ref('density')
const algorithm = ref('distanceField')
const points = ref([])
const running = ref(false)
const progress = ref('')

const paramLabel = computed(() => ({ density: '人员密度', size: '网格尺寸', exits: '出口数量' })[param.value])
const paramHint = computed(() => ({
  density: '以空地比例为 10% / 20% / 30% / 40% 生成人员，观察疏散时间随人群密度变化。',
  size: '网格尺寸取 10 / 20 / 30 / 40，保持 20% 密度与 1 个出口。',
  exits: '出口数量 1 / 2 / 3 / 4，出口均匀分布在边界上。'
})[param.value])
const algoLabel = computed(() => algorithms.value.find((a) => a.id === algorithm.value)?.label || algorithm.value)

function buildBase() {
  // 基准 20×20 全空地
  const rows = 20
  const cols = 20
  const cells = Array.from({ length: rows }, () => Array(cols).fill(0))
  return { rows, cols, cells }
}

function placeExits(cells, n) {
  const rows = cells.length
  const cols = cells[0].length
  const exits = []
  const boundary = []
  for (let c = 0; c < cols; c += 1) {
    boundary.push([0, c], [rows - 1, c])
  }
  for (let r = 1; r < rows - 1; r += 1) {
    boundary.push([r, 0], [r, cols - 1])
  }
  // 均匀抽 n 个边界点
  const step = Math.floor(boundary.length / n) || 1
  for (let i = 0; i < n && i * step < boundary.length; i++) {
    const [r, c] = boundary[i * step]
    exits.push({ row: r, col: c })
  }
  return exits.slice(0, n)
}

function genAgents(cells, densityPct) {
  const rows = cells.length
  const cols = cells[0].length
  const free = []
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) free.push({ row: r, col: c })
  const n = Math.round((rows * cols * densityPct) / 100)
  for (let i = free.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[free[i], free[j]] = [free[j], free[i]]
  }
  return free.slice(0, n)
}

async function runSweep() {
  running.value = true
  points.value = []
  const cases = param.value === 'density'
    ? [10, 20, 30, 40].map((v) => ({ label: v + '%', build: () => {
        const base = buildBase()
        return { ...base, exits: placeExits(base.cells, 1), agents: genAgents(base.cells, v) }
      } }))
    : param.value === 'size'
      ? [10, 20, 30, 40].map((v) => ({ label: `${v}×${v}`, build: () => {
          const cells = Array.from({ length: v }, () => Array(v).fill(0))
          return { cells, exits: placeExits(cells, 1), agents: genAgents(cells, 20) }
        } }))
      : [1, 2, 3, 4].map((v) => ({ label: `${v} 个`, build: () => {
          const base = buildBase()
          return { ...base, exits: placeExits(base.cells, v), agents: genAgents(base.cells, 25) }
        } }))

  try {
    for (let i = 0; i < cases.length; i++) {
      const c = cases[i]
      progress.value = `${c.label}（${i + 1}/${cases.length}）`
      const scene = c.build()
      try {
        const data = await ws.runSimulation({
          grid: scene.cells,
          exits: scene.exits,
          agents: scene.agents,
          algorithm: algorithm.value
        })
        points.value.push({
          x: c.label,
          totalSteps: data.stats.totalSteps,
          avgPathLength: data.stats.avgPathLength,
          maxPathLength: data.stats.maxPathLength,
          unreachableCount: data.stats.unreachableCount,
          computationTime: data.computationTime
        })
      } catch {
        points.value.push({ x: c.label, totalSteps: '-', avgPathLength: '-', maxPathLength: '-', unreachableCount: '-', computationTime: '-' })
      }
    }
  } finally {
    running.value = false
    progress.value = ''
  }
}

function exportCsv() {
  const head = `${paramLabel.value},总步数,平均路径,不可达,耗时(ms)\n`
  const lines = points.value.map((p) => `${p.x},${p.totalSteps},${p.avgPathLength},${p.unreachableCount},${p.computationTime}`)
  const blob = new Blob(['\uFEFF' + head + lines.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `bsess_param_cmp_${Date.now()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

onMounted(() => ws.initBackend())
</script>

<style scoped>
.empty-card {
  background: #fff;
  border-radius: 10px;
  padding: 48px 24px;
  text-align: center;
}
.red {
  color: #a32d2d;
  font-weight: 600;
}
</style>
