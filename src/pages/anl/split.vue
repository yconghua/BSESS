<template>
  <FunctionPage title="出口分流" sub="统计各出口疏散人数占比与分流情况">
    <template #actions>
      <button class="fp-btn" :disabled="!s.result" @click="exportJson">导出 JSON</button>
    </template>

    <div v-if="!s.result" class="empty-card">
      <p class="fp-hint">暂无仿真结果，请先运行一次疏散（仿真 → 疏散运行）。</p>
    </div>

    <template v-else>
      <div class="fp-card">
        <h3 class="fp-card-title">各出口疏散占比</h3>
        <div v-for="e in s.result.stats.exitDistribution" :key="`${e.row}-${e.col}`" class="split-row">
          <span class="split-label">出口({{ e.row }},{{ e.col }})</span>
          <div class="split-track">
            <div class="split-fill" :style="{ width: splitPct(e.count) }"></div>
          </div>
          <span class="split-value">{{ e.count }} 人 · {{ splitPct(e.count) }}</span>
        </div>
        <p class="fp-hint">
          分流由「距离场」自动实现：每个人员前往最近出口。若某出口无人使用（0%），说明该出口相对所有人员都更远，可考虑调整出口布局。
        </p>
      </div>

      <div class="fp-card" style="margin-top:14px">
        <h3 class="fp-card-title">分流明细</h3>
        <table class="fp-table">
          <thead>
            <tr>
              <th>出口位置</th>
              <th>疏散人数</th>
              <th>占比</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="e in s.result.stats.exitDistribution" :key="`${e.row}-${e.col}`">
              <td>({{ e.row }}，{{ e.col }})</td>
              <td>{{ e.count }}</td>
              <td>{{ splitPct(e.count) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </FunctionPage>
</template>

<script setup>
// 分析 · 出口分流：各出口人数占比
import FunctionPage from '@/components/FunctionPage.vue'
import { useWorkspace } from '@/composables/useWorkspace'

const ws = useWorkspace()
const s = ws.state

function splitPct(count) {
  const total = s.agents.length || 1
  return Math.round((count / total) * 100) + '%'
}

function exportJson() {
  const blob = new Blob([JSON.stringify(s.result.stats.exitDistribution, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `bsess_split_${Date.now()}.json`
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
.split-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  padding: 8px 0;
}
.split-label {
  width: 110px;
  color: #4e5969;
  flex-shrink: 0;
}
.split-track {
  flex: 1;
  height: 16px;
  background: #f1f3f6;
  border-radius: 8px;
  overflow: hidden;
}
.split-fill {
  height: 100%;
  background: linear-gradient(90deg, #2ecc71, #185fa5);
  border-radius: 8px;
  transition: width 0.4s;
}
.split-value {
  width: 110px;
  color: #6a7078;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}
</style>
