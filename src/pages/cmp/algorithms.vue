<template>
  <FunctionPage title="算法对比" sub="同场景下全部算法的耗时与路径差异对比">
    <template #actions>
      <button class="fp-btn primary" :disabled="running || !sceneReady" @click="runBatch">
        {{ running ? `运行中 ${progress}` : '开始对比' }}
      </button>
      <button class="fp-btn" :disabled="!rows.length" @click="exportCsv">导出 CSV</button>
      <button class="fp-btn" :disabled="!rows.length" @click="exportJson">导出 JSON</button>
    </template>

    <template #side>
      <div class="fp-card">
        <h3 class="fp-card-title">对比场景</h3>
        <p class="fp-hint">使用「仿真工作台」当前场景（{{ s.rows }}×{{ s.cols }} · 出口 {{ s.exits.length }} · 人员 {{ s.agents.length }}）。</p>
        <p class="fp-hint" :class="{ err: !sceneReady }">
          {{ sceneReady ? '场景就绪，可开始对比' : '请先在「场景」各页完成环境搭建' }}
        </p>
      </div>
      <div class="fp-card">
        <h3 class="fp-card-title">说明</h3>
        <p class="fp-hint">依次运行六种算法；距离类四算法最优代价一致，差异体现在计算耗时；CA / SFM 为多智能体仿真，步数含拥堵等待。</p>
      </div>
    </template>

    <div v-if="!rows.length && !running" class="empty-card">
      <p class="fp-hint">点击右上角「开始对比」运行全部算法。</p>
    </div>

    <template v-else>
      <div class="fp-card">
        <h3 class="fp-card-title">计算耗时对比</h3>
        <div v-for="row in rows" :key="row.id" class="bar-row">
          <span class="bar-label">{{ row.label }}</span>
          <div class="bar-track">
            <div class="bar-fill" :class="{ gray: typeof row.computationTime !== 'number' }" :style="{ width: barWidth(row) }"></div>
          </div>
          <span class="bar-value">{{ row.computationTime }} ms</span>
        </div>
      </div>
      <div class="fp-card" style="margin-top:14px">
        <h3 class="fp-card-title">结果明细</h3>
        <table class="fp-table">
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
            <tr v-for="row in rows" :key="row.id">
              <td>{{ row.label }}</td>
              <td>{{ row.computationTime }}</td>
              <td>{{ row.totalSteps }}</td>
              <td>{{ row.avgPathLength }}</td>
              <td>{{ row.maxPathLength }}</td>
              <td :class="{ red: row.unreachableCount > 0 }">{{ row.unreachableCount }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </FunctionPage>
</template>

<script setup>
// 对比 · 算法对比：工作台场景 × 全部算法
import { computed, onMounted, ref } from 'vue'
import FunctionPage from '@/components/FunctionPage.vue'
import { useWorkspace } from '@/composables/useWorkspace'

const ws = useWorkspace()
const s = ws.state
const rows = ref([])
const running = ref(false)
const progress = ref('')

const sceneReady = computed(() => s.exits.length > 0 && s.agents.length > 0)

async function runBatch() {
  if (!sceneReady.value) return
  running.value = true
  rows.value = []
  try {
    for (let i = 0; i < ws.algorithms.value.length; i++) {
      const a = ws.algorithms.value[i]
      progress.value = `${a.label}（${i + 1}/${ws.algorithms.value.length}）`
      try {
        const data = await ws.runSimulation({
          grid: s.cells,
          exits: s.exits,
          agents: s.agents,
          algorithm: a.id
        })
        rows.value.push({
          id: a.id,
          label: a.label,
          computationTime: data.computationTime,
          totalSteps: data.stats.totalSteps,
          avgPathLength: data.stats.avgPathLength,
          maxPathLength: data.stats.maxPathLength,
          unreachableCount: data.stats.unreachableCount
        })
      } catch {
        rows.value.push({ id: a.id, label: a.label, computationTime: '-', totalSteps: '-', avgPathLength: '-', maxPathLength: '-', unreachableCount: '-' })
      }
    }
  } finally {
    running.value = false
    progress.value = ''
  }
}

function barWidth(row) {
  if (typeof row.computationTime !== 'number') return '0%'
  const max = Math.max(...rows.value.map((r) => (typeof r.computationTime === 'number' ? r.computationTime : 0)))
  return max > 0 ? `${Math.max((row.computationTime / max) * 100, 2)}%` : '0%'
}

function exportCsv() {
  const head = '算法,耗时(ms),总步数,平均路径,最长路径,不可达\n'
  const lines = rows.value.map((r) => `${r.label},${r.computationTime},${r.totalSteps},${r.avgPathLength},${r.maxPathLength},${r.unreachableCount}`)
  download(`bsess_algo_cmp_${Date.now()}.csv`, '\uFEFF' + head + lines.join('\n'), 'text/csv')
}

function exportJson() {
  download(`bsess_algo_cmp_${Date.now()}.json`, JSON.stringify({ rows: s.rows, cols: s.cols, results: rows.value }, null, 2), 'application/json')
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

onMounted(() => ws.initBackend())
</script>

<style scoped>
.empty-card {
  background: #fff;
  border-radius: 10px;
  padding: 48px 24px;
  text-align: center;
}
.bar-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  padding: 5px 0;
}
.bar-label {
  width: 110px;
  color: #4e5969;
  text-align: right;
  flex-shrink: 0;
}
.bar-track {
  flex: 1;
  height: 14px;
  background: #f1f3f6;
  border-radius: 7px;
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #378add, #185fa5);
  border-radius: 7px;
  transition: width 0.4s;
}
.bar-fill.gray {
  background: #d3d1c7;
}
.bar-value {
  width: 80px;
  color: #6a7078;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}
.red {
  color: #a32d2d;
  font-weight: 600;
}
</style>
