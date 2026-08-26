<template>
  <FunctionPage title="报告导出" sub="将对比结果导出为 HTML 报告（可另存为 PDF）或 CSV 数据">
    <template #actions>
      <button class="fp-btn primary" :disabled="running" @click="generateReport">
        {{ running ? '生成中…' : '生成报告' }}
      </button>
      <button class="fp-btn" :disabled="!lastReport" @click="downloadCsv">导出 CSV</button>
      <button class="fp-btn" :disabled="!lastReport" @click="downloadHtml">下载 HTML</button>
    </template>

    <div class="fp-card">
      <h3 class="fp-card-title">报告内容</h3>
      <p class="fp-hint">
        对「仿真工作台」当前场景（{{ s.rows }}×{{ s.cols }} · 出口 {{ s.exits.length }} · 人员 {{ s.agents.length }}）自动运行全部算法，
        生成包含「算法对比表 + 耗时条形图 + 出口分流 + 结论摘要」的自包含 HTML 报告。
      </p>
      <p class="fp-hint">HTML 报告可在浏览器中打开，按 Ctrl+P 即可另存为 PDF；CSV 可直接用于论文附表。</p>
    </div>

    <div v-if="lastReport" class="fp-card" style="margin-top:14px">
      <h3 class="fp-card-title">最近一次报告（{{ lastReport.time }}）</h3>
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
          <tr v-for="row in lastReport.rows" :key="row.id">
            <td>{{ row.label }}</td>
            <td>{{ row.computationTime }}</td>
            <td>{{ row.totalSteps }}</td>
            <td>{{ row.avgPathLength }}</td>
            <td>{{ row.maxPathLength }}</td>
            <td>{{ row.unreachableCount }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </FunctionPage>
</template>

<script setup>
// 对比 · 报告导出：全算法报告（HTML 可打印 PDF）+ CSV
import { computed, onMounted, ref } from 'vue'
import FunctionPage from '@/components/FunctionPage.vue'
import { useWorkspace } from '@/composables/useWorkspace'

const ws = useWorkspace()
const s = ws.state
const running = ref(false)
const lastReport = ref(null)

const sceneReady = computed(() => s.exits.length > 0 && s.agents.length > 0)

async function generateReport() {
  if (!sceneReady.value) {
    ws.showNotice('请先在「场景」各页完成环境搭建（至少 1 出口 + 若干人员）', true)
    return
  }
  running.value = true
  const results = []
  try {
    for (let i = 0; i < ws.algorithms.value.length; i++) {
      const a = ws.algorithms.value[i]
      try {
        const data = await ws.runSimulation({ grid: s.cells, exits: s.exits, agents: s.agents, algorithm: a.id })
        results.push({ id: a.id, label: a.label, computationTime: data.computationTime, totalSteps: data.stats.totalSteps, avgPathLength: data.stats.avgPathLength, maxPathLength: data.stats.maxPathLength, unreachableCount: data.stats.unreachableCount })
      } catch {
        results.push({ id: a.id, label: a.label, computationTime: '-', totalSteps: '-', avgPathLength: '-', maxPathLength: '-', unreachableCount: '-' })
      }
    }
    lastReport.value = { rows: results, time: new Date().toLocaleString() }
    ws.showNotice('报告已生成，可下载 HTML（Ctrl+P 另存 PDF）或 CSV')
  } finally {
    running.value = false
  }
}

function buildHtml() {
  const r = lastReport.value
  if (!r) return ''
  const rowsHtml = r.rows
    .map((x) => `<tr><td>${x.label}</td><td>${x.computationTime}</td><td>${x.totalSteps}</td><td>${x.avgPathLength}</td><td>${x.maxPathLength}</td><td>${x.unreachableCount}</td></tr>`)
    .join('')
  const maxT = Math.max(...r.rows.map((x) => (typeof x.computationTime === 'number' ? x.computationTime : 0)), 1)
  const barsHtml = r.rows
    .map((x) => {
      const w = typeof x.computationTime === 'number' ? Math.max((x.computationTime / maxT) * 100, 2) : 0
      return `<div style="display:flex;align-items:center;gap:8px;margin:4px 0;font-size:13px">
        <span style="width:120px;text-align:right">${x.label}</span>
        <div style="flex:1;height:14px;background:#f1f3f6;border-radius:7px;overflow:hidden">
          <div style="width:${w}%;height:100%;background:#185fa5;border-radius:7px"></div>
        </div>
        <span style="width:80px">${x.computationTime} ms</span>
      </div>`
    })
    .join('')
  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>BSESS 疏散仿真报告</title>
<style>body{font-family:system-ui,sans-serif;max-width:860px;margin:24px auto;padding:0 16px;color:#1d2129}
h1{font-size:22px}h2{font-size:16px;margin-top:24px}table{width:100%;border-collapse:collapse;font-size:13px}
th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #eceff3}th{background:#f7f8fa}
.meta{color:#6a7078;font-size:12px}</style></head><body>
<h1>BSESS 疏散仿真报告</h1>
<p class="meta">生成时间：${r.time} · 场景：${s.rows}×${s.cols} · 出口 ${s.exits.length} · 人员 ${s.agents.length}</p>
<h2>算法对比表</h2>
<table><thead><tr><th>算法</th><th>耗时(ms)</th><th>总步数</th><th>平均路径</th><th>最长路径</th><th>不可达</th></tr></thead>
<tbody>${rowsHtml}</tbody></table>
<h2>计算耗时对比</h2>${barsHtml}
<h2>结论摘要</h2>
<p>距离类四算法最优代价一致（差异在耗时）；CA 与 SFM 为多智能体仿真，总步数含拥堵等待，数值通常高于最短路。
  若 CA/SFM 总步数显著高于距离场，说明该场景存在出口拥堵瓶颈，可尝试增加出口或调整布局。</p>
</body></html>`
}

function downloadHtml() {
  downloadFile(`bsess_report_${Date.now()}.html`, buildHtml(), 'text/html')
}

function downloadCsv() {
  const head = '算法,耗时(ms),总步数,平均路径,最长路径,不可达\n'
  const lines = lastReport.value.rows.map((r) => `${r.label},${r.computationTime},${r.totalSteps},${r.avgPathLength},${r.maxPathLength},${r.unreachableCount}`)
  downloadFile(`bsess_report_${Date.now()}.csv`, '\uFEFF' + head + lines.join('\n'), 'text/csv')
}

function downloadFile(name, content, type) {
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
