<template>
  <div class="wb">
    <!-- 顶部全局操作：仅保留三个高频按钮 -->
    <div class="wb-toolbar">
      <span class="wb-title">疏散仿真工作台</span>
      <span class="wb-sub">点击左侧对象或场景中的实体，右侧面板即时显示对应配置</span>
      <div class="wb-actions">
        <button class="fp-btn" @click="exportSceneJson">导出场景</button>
        <button class="fp-btn" @click="importFileRef.click()">导入场景</button>
        <input ref="importFileRef" type="file" accept=".json,application/json" style="display:none" @change="onImportScene" />
        <button class="fp-btn primary" :disabled="reporting" @click="exportReport">{{ reporting ? '生成中…' : '导出报告' }}</button>
      </div>
    </div>

    <!-- 三段式主体：左对象树 | 中 3D 场景 | 右属性面板 -->
    <div class="wb-body">
      <aside class="wb-tree">
        <EntityTree :selected="selected" @select="onSelect" />
      </aside>
      <div class="wb-scene">
        <GridCanvas
          ref="gridRef"
          :mode="s.mode"
          @cell-click="ws.onCellClick"
          @entity-select="onSelect"
          @empty-select="onSelect({ type: 'space' })"
        />
        <div v-if="s.evacActive" class="hud">
          <span v-if="s.evacDone >= s.agents.length" class="hud-done">疏散完成</span>
          <template v-else>已疏散 <b>{{ s.evacDone }}</b>/{{ s.agents.length }} 人 · 步 {{ s.evacStep }}/{{ s.evacTotal }}</template>
        </div>
        <div class="legend">
          <span><i class="dot" style="background:#555b66"></i>障碍</span>
          <span><i class="dot" style="background:#2ecc71"></i>出口</span>
          <span><i class="dot" style="background:#3498db"></i>人员</span>
          <span><i class="dot" style="background:#f5a623"></i>选中</span>
          <span class="hint">选择模式点实体 / 左键拖动旋转 / 滚轮缩放</span>
        </div>
      </div>
      <aside class="wb-panel">
        <PropertyPanel :selected="selected" @select="onSelect" />
      </aside>
    </div>
  </div>
</template>

<script setup>
/**
 * 疏散仿真工作台 —— 三段式设计：
 *   左：对象树（空间/障碍物/出口/人员/仿真/结果，可展开定位）
 *   中：3D 场景（点击实体高亮，模式切换可涂绘）
 *   右：上下文属性面板（随选中对象动态切换配置）
 * 顶部仅保留导出/导入场景、导出报告三个全局操作。
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import GridCanvas from '@/components/evacuation/GridCanvas.vue'
import EntityTree from '@/components/workbench/EntityTree.vue'
import PropertyPanel from '@/components/workbench/PropertyPanel.vue'
import { useWorkspace } from '@/composables/useWorkspace'

const ws = useWorkspace()
const s = ws.state
const gridRef = ref(null)
const importFileRef = ref(null)
const selected = ref({ type: 'space' })
const reporting = ref(false)

/** 选中对象：同步 3D 高亮与相机聚焦，右侧面板自动切换 */
function onSelect(sel) {
  selected.value = sel
  const g = gridRef.value
  if (!g) return
  if (sel.type === 'obstacle' || sel.type === 'exit' || sel.type === 'agent') {
    g.setHighlight(sel.type, sel.index)
    g.focusOn(sel.type, sel.index)
  } else if (sel.type === 'space') {
    g.clearHighlight()
    g.focusCenter()
  } else {
    g.clearHighlight()
  }
}

// ---------------- 导出 / 导入场景 ----------------
function exportSceneJson() {
  const scenario = {
    version: '1.0',
    grid: { rows: s.rows, cols: s.cols, cells: s.cells },
    exits: s.exits,
    agents: s.agents,
    settings: { algorithm: s.algorithm },
    metadata: { name: '工作台场景', createdAt: new Date().toISOString() }
  }
  download(`bsess_scene_${Date.now()}.json`, JSON.stringify(scenario, null, 2), 'application/json')
  ws.showNotice('场景已导出为 JSON')
}

function onImportScene(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result)
      const g = data.grid || {}
      if (!g.rows || !g.cols || !Array.isArray(g.cells)) {
        ws.showNotice('导入失败：JSON 缺少 grid（rows/cols/cells）', true)
        return
      }
      if (!Array.isArray(data.exits) || !Array.isArray(data.agents)) {
        ws.showNotice('导入失败：JSON 缺少 exits / agents 数组', true)
        return
      }
      ws.applyScene({ name: data.metadata?.name || '导入场景', gridData: g, exits: data.exits, agents: data.agents, settings: data.settings || null })
      onSelect({ type: 'space' })
      ws.showNotice(`场景已导入：${g.rows}×${g.cols}`)
    } catch {
      ws.showNotice('导入失败：JSON 解析错误', true)
    }
  }
  reader.readAsText(file)
}

// ---------------- 导出报告（HTML 可打印 PDF） ----------------
async function exportReport() {
  if (!s.exits.length || !s.agents.length) {
    ws.showNotice('请先布置出口和人员再导出报告', true)
    return
  }
  reporting.value = true
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
    const rowsHtml = results.map((x) => `<tr><td>${x.label}</td><td>${x.computationTime}</td><td>${x.totalSteps}</td><td>${x.avgPathLength}</td><td>${x.maxPathLength}</td><td>${x.unreachableCount}</td></tr>`).join('')
    const maxT = Math.max(...results.map((x) => (typeof x.computationTime === 'number' ? x.computationTime : 0)), 1)
    const barsHtml = results.map((x) => {
      const w = typeof x.computationTime === 'number' ? Math.max((x.computationTime / maxT) * 100, 2) : 0
      return `<div style="display:flex;align-items:center;gap:8px;margin:4px 0;font-size:13px"><span style="width:120px;text-align:right">${x.label}</span><div style="flex:1;height:14px;background:#f1f3f6;border-radius:7px;overflow:hidden"><div style="width:${w}%;height:100%;background:#185fa5;border-radius:7px"></div></div><span style="width:80px">${x.computationTime} ms</span></div>`
    }).join('')
    const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>BSESS 疏散仿真报告</title><style>body{font-family:system-ui,sans-serif;max-width:860px;margin:24px auto;padding:0 16px;color:#1d2129}h1{font-size:22px}h2{font-size:16px;margin-top:24px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #eceff3}th{background:#f7f8fa}.meta{color:#6a7078;font-size:12px}</style></head><body><h1>BSESS 疏散仿真报告</h1><p class="meta">生成时间：${new Date().toLocaleString()} · 场景：${s.rows}×${s.cols} · 出口 ${s.exits.length} · 人员 ${s.agents.length}</p><h2>算法对比表</h2><table><thead><tr><th>算法</th><th>耗时(ms)</th><th>总步数</th><th>平均路径</th><th>最长路径</th><th>不可达</th></tr></thead><tbody>${rowsHtml}</tbody></table><h2>计算耗时对比</h2>${barsHtml}<h2>结论摘要</h2><p>距离类四算法最优代价一致（差异在耗时）；CA 与 SFM 为多智能体仿真，总步数含拥堵等待。若 CA/SFM 总步数显著高于最短路，说明存在出口拥堵瓶颈，可尝试增加出口或调整布局。</p></body></html>`
    download(`bsess_report_${Date.now()}.html`, html, 'text/html')
    ws.showNotice('报告已生成（浏览器打开后 Ctrl+P 可另存为 PDF）')
  } finally {
    reporting.value = false
  }
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
onBeforeUnmount(() => {
  ws.unmountCanvas()
  ws.stop()
})
</script>

<style scoped>
.wb {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.wb-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.wb-title {
  font-size: 17px;
  font-weight: 700;
  white-space: nowrap;
}
.wb-sub {
  font-size: 12px;
  color: #8a9099;
  flex: 1;
  min-width: 0;
}
.wb-actions {
  display: flex;
  gap: 8px;
}
.wb-body {
  flex: 1;
  display: flex;
  gap: 12px;
  min-height: 0;
}
.wb-tree {
  width: 230px;
  flex-shrink: 0;
  background: #fff;
  border: 1px solid #e6e9ef;
  border-radius: 10px;
  padding: 10px;
  overflow-y: auto;
}
.wb-scene {
  flex: 1;
  min-width: 0;
  position: relative;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid #e6e9ef;
  background: #f5f6f9;
}
.wb-panel {
  width: 300px;
  flex-shrink: 0;
  overflow-y: auto;
}
.hud {
  position: absolute;
  top: 12px;
  right: 12px;
  padding: 6px 14px;
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid #e6e9ef;
  border-radius: 8px;
  font-size: 13px;
  color: #3a3f47;
}
.hud b {
  color: #185fa5;
}
.hud-done {
  color: #3b6d11;
  font-weight: 600;
}
.legend {
  position: absolute;
  left: 12px;
  bottom: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
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
