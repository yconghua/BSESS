<template>
  <FunctionPage title="统计报表" sub="单次仿真核心指标：总步数 / 平均 / 最长 / 不可达">
    <template #actions>
      <button class="fp-btn" :disabled="!hasResult" @click="exportCsv">导出 CSV</button>
      <button class="fp-btn" :disabled="!hasResult" @click="exportJson">导出 JSON</button>
    </template>

    <div v-if="!hasResult" class="empty-card">
      <p class="fp-hint">暂无仿真结果。请到「仿真 · 疏散运行」执行一次疏散后再来查看报表。</p>
    </div>

    <template v-else>
      <div class="stat-grid">
        <div class="stat-cell">
          <span class="stat-num">{{ s.result.stats.totalSteps }}</span>
          <span class="stat-label">总步数（makespan）</span>
        </div>
        <div class="stat-cell">
          <span class="stat-num">{{ s.result.stats.avgPathLength }}</span>
          <span class="stat-label">平均路径</span>
        </div>
        <div class="stat-cell">
          <span class="stat-num">{{ s.result.stats.maxPathLength }}</span>
          <span class="stat-label">最长路径</span>
        </div>
        <div class="stat-cell">
          <span class="stat-num" :class="{ red: s.result.stats.unreachableCount > 0 }">{{ s.result.stats.unreachableCount }}</span>
          <span class="stat-label">不可达人数</span>
        </div>
        <div class="stat-cell">
          <span class="stat-num">{{ s.result.computationTime }}</span>
          <span class="stat-label">计算耗时 (ms)</span>
        </div>
        <div class="stat-cell">
          <span class="stat-num">{{ s.agents.length }}</span>
          <span class="stat-label">总人数</span>
        </div>
      </div>

      <div class="fp-card" style="margin-top:14px">
        <h3 class="fp-card-title">出口分流</h3>
        <div class="split-row" v-for="e in s.result.stats.exitDistribution" :key="`${e.row}-${e.col}`">
          <span class="split-label">出口({{ e.row }},{{ e.col }})</span>
          <div class="split-track">
            <div class="split-fill" :style="{ width: splitPct(e.count) }"></div>
          </div>
          <span class="split-value">{{ e.count }} 人（{{ splitPct(e.count) }}）</span>
        </div>
      </div>
    </template>
  </FunctionPage>
</template>

<script setup>
// 分析 · 统计报表：核心指标 + 出口分流
import { computed } from 'vue'
import FunctionPage from '@/components/FunctionPage.vue'
import { useWorkspace } from '@/composables/useWorkspace'

const ws = useWorkspace()
const s = ws.state
const hasResult = computed(() => !!s.result)

function splitPct(count) {
  const total = s.agents.length || 1
  return Math.round((count / total) * 100) + '%'
}

function exportCsv() {
  const st = s.result.stats
  const head = '指标,值\n'
  const lines = [
    `总步数(makespan),${st.totalSteps}`,
    `平均路径,${st.avgPathLength}`,
    `最长路径,${st.maxPathLength}`,
    `不可达人数,${st.unreachableCount}`,
    `计算耗时(ms),${s.result.computationTime}`,
    `总人数,${s.agents.length}`
  ]
  download(`bsess_report_${Date.now()}.csv`, '\uFEFF' + head + lines.join('\n'), 'text/csv')
}

function exportJson() {
  download(`bsess_report_${Date.now()}.json`, JSON.stringify(s.result, null, 2), 'application/json')
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
</script>

<style scoped>
.empty-card {
  background: #fff;
  border-radius: 10px;
  padding: 48px 24px;
  text-align: center;
}
.stat-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}
.stat-cell {
  background: #fff;
  border: 1px solid #e6e9ef;
  border-radius: 12px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.stat-num {
  font-size: 30px;
  font-weight: 700;
  color: #185fa5;
  font-variant-numeric: tabular-nums;
}
.stat-num.red {
  color: #a32d2d;
}
.stat-label {
  font-size: 12px;
  color: #8a9099;
}
.split-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  padding: 6px 0;
}
.split-label {
  width: 110px;
  color: #4e5969;
  flex-shrink: 0;
}
.split-track {
  flex: 1;
  height: 14px;
  background: #f1f3f6;
  border-radius: 7px;
  overflow: hidden;
}
.split-fill {
  height: 100%;
  background: linear-gradient(90deg, #2ecc71, #185fa5);
  border-radius: 7px;
  transition: width 0.4s;
}
.split-value {
  width: 110px;
  color: #6a7078;
  font-variant-numeric: tabular-nums;
}
</style>
