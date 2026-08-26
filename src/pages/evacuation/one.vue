<template>
  <div class="page">
    <div class="page-header">
      <h2 class="page-title">疏散仿真</h2>
      <span class="page-sub">画空间 → 选算法 → 开始疏散（Python 计算，3D 动画播放）</span>
      <div class="header-actions">
        <button class="btn" @click="openSaveScene">保存场景</button>
        <button class="btn" @click="exportSceneJson">导出 JSON</button>
        <button class="btn" @click="importFileRef.click()">导入 JSON</button>
        <input ref="importFileRef" type="file" accept=".json,application/json" style="display:none" @change="onImportScene" />
        <button class="btn" :class="{ active: heatmapOn }" @click="toggleHeatmap">热力图</button>
        <button class="btn" :disabled="batchRunning" @click="openBatchCompare">对比全部算法</button>
      </div>
    </div>

    <!-- 轻提示（场景加载/保存/记录结果） -->
    <transition name="fade">
      <div v-if="notice" class="notice" :class="{ err: noticeErr }">{{ notice }}</div>
    </transition>

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

    <!-- 保存场景弹窗 -->
    <div v-if="showSave" class="modal-mask" @click.self="showSave = false">
      <div class="modal-box">
        <h3 class="modal-title">保存场景</h3>
        <label class="field">
          <span>名称</span>
          <input v-model="saveForm.name" class="input" placeholder="如：车厢疏散示例" />
        </label>
        <label class="field">
          <span>描述（可选）</span>
          <textarea v-model="saveForm.description" class="input" rows="2" placeholder="场景说明"></textarea>
        </label>
        <p v-if="saveMsg" class="msg" :class="{ err: !saveOk }">{{ saveMsg }}</p>
        <div class="modal-actions">
          <button class="btn" @click="showSave = false">取消</button>
          <button class="btn primary" :disabled="saving" @click="onSubmitSave">{{ saving ? '保存中…' : '保存' }}</button>
        </div>
      </div>
    </div>

    <!-- 批量算法对比弹窗 -->
    <div v-if="showBatch" class="modal-mask" @click.self="showBatch = false">
      <div class="modal-box wide">
        <h3 class="modal-title">算法对比（同一场景 × 全部算法）</h3>
        <table v-if="batchRows.length" class="cmp-table">
          <thead>
            <tr>
              <th>算法</th>
              <th>耗时(ms)</th>
              <th>总步数</th>
              <th>平均</th>
              <th>最长</th>
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
        <p v-if="batchRunning" class="hint">正在运行：{{ batchProgress }}</p>
        <p v-else-if="batchErr" class="msg err">{{ batchErr }}</p>
        <p v-else-if="!batchRows.length" class="hint">点击下方「开始对比」执行全部算法</p>
        <div class="modal-actions">
          <button class="btn" @click="showBatch = false">关闭</button>
          <button v-if="batchRows.length" class="btn" @click="exportBatchCsv">导出 CSV</button>
          <button v-if="batchRows.length" class="btn" @click="exportBatchJson">导出 JSON</button>
          <button class="btn primary" :disabled="batchRunning" @click="runBatchCompare">
            {{ batchRunning ? '对比中…' : '开始对比' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * 疏散仿真页（M0 编排器 + M2/M3 扩展）：
 *   涂绘 / 随机 / 仿真 / 统计（M0）；
 *   保存场景到 MySQL、仿真后自动写记录、批量算法对比（M2/M3）。
 */
import { computed, onMounted, ref } from 'vue'
import GridCanvas from '@/components/evacuation/GridCanvas.vue'
import ControlPanel from '@/components/evacuation/ControlPanel.vue'
import { useSimulation } from '@/composables/useSimulation'
import { takePendingScene } from '@/composables/useSceneStore'

const gridRef = ref(null)
const importFileRef = ref(null)
const { loading, error, result, algorithms, initBackendUrl, fetchAlgorithms, runSimulation } = useSimulation()

// 热力图状态（距离场由后端每次返回，开关决定是否叠加渲染）
const heatmapOn = ref(false)
const lastDistanceField = ref(null)

// 场景状态
const rows = ref(20)
const cols = ref(30)
const cells = ref([])
const exits = ref([])
const agents = ref([])
const mode = ref('obstacle')
const algorithm = ref('distanceField')
const stats = ref(null)
const resultMs = ref(0)

// 轻提示
const notice = ref('')
const noticeErr = ref(false)
let noticeTimer = 0
function showNotice(msg, isErr = false) {
  notice.value = msg
  noticeErr.value = isErr
  clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => (notice.value = ''), 3000)
}

const obstacleCount = computed(() => cells.value.flat().filter((v) => v === 1).length)

function renderScene() {
  gridRef.value?.renderGrid({ rows: rows.value, cols: cols.value, cells: cells.value, exits: exits.value, agents: agents.value })
}

// ---------------- 场景编辑（M0） ----------------
function onGenerate({ rows: r, cols: c }) {
  rows.value = r
  cols.value = c
  cells.value = Array.from({ length: r }, () => Array(c).fill(0))
  exits.value = []
  agents.value = []
  stats.value = null
  error.value = ''
  clearHeatmapState()
  renderScene()
}

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
      ? exits.value.filter((e) => !(e.row === row && e.col === col))
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
  // 地形/出口变化会让旧距离场失效，仅人员变化时保留
  if (mode.value !== 'agent') clearHeatmapState()
  renderScene()
}

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
  clearHeatmapState()
  renderScene()
}

// ---------------- 仿真（M0）+ 自动记录（M2） ----------------
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
    // 保存距离场供热力图开关使用；开关已开则直接叠加
    lastDistanceField.value = data.distanceField
    if (heatmapOn.value) gridRef.value?.setHeatmap(data.distanceField)
    saveRecord(data)
  } catch {
    // 错误信息已由 useSimulation 写入 error
  }
}

/** 仿真结果落库（Electron 环境；纯浏览器跳过并提示） */
async function saveRecord(data) {
  if (!window.api?.simRecord?.save) {
    showNotice('浏览器模式不记录仿真历史（Electron 桌面端自动记录）', true)
    return
  }
  try {
    const res = await window.api.simRecord.save({
      algorithm: algorithm.value,
      stats: data.stats,
      paths: data.agentPaths,
      computationTimeMs: data.computationTime
    })
    if (res?.success) showNotice(`已记录仿真历史（#${res.id}）`)
  } catch {
    // 记录失败不影响主流程
  }
}

function onReset() {
  gridRef.value?.stopPaths()
  stats.value = null
  resultMs.value = 0
  renderScene()
}

// ---------------- 热力图（M1 补全） ----------------
/** 清空热力图状态（场景地形/出口变化时调用） */
function clearHeatmapState() {
  heatmapOn.value = false
  lastDistanceField.value = null
  gridRef.value?.clearHeatmap()
}

/** 热力图开关：有距离场数据才可开 */
function toggleHeatmap() {
  if (!heatmapOn.value && !lastDistanceField.value) {
    showNotice('请先运行一次仿真（任意算法），拿到距离场数据后即可叠加热力图', true)
    return
  }
  heatmapOn.value = !heatmapOn.value
  if (heatmapOn.value) gridRef.value?.setHeatmap(lastDistanceField.value)
  else gridRef.value?.clearHeatmap()
}

// ---------------- 场景 JSON 导出 / 导入（M1 补全） ----------------
/** 导出当前场景为 JSON 文件（结构 = Scenario：grid/exits/agents/settings/metadata） */
function exportSceneJson() {
  const scenario = {
    version: '1.0',
    grid: { rows: rows.value, cols: cols.value, cells: cells.value },
    exits: exits.value,
    agents: agents.value,
    settings: { algorithm: algorithm.value },
    metadata: { name: '未命名场景', createdAt: new Date().toISOString() }
  }
  downloadFile(`bsess_scene_${Date.now()}.json`, JSON.stringify(scenario, null, 2), 'application/json')
  showNotice('场景已导出为 JSON')
}

/** 导入场景 JSON 文件：解析校验后应用到编辑器 */
function onImportScene(e) {
  const file = e.target.files?.[0]
  e.target.value = '' // 允许重复导入同一文件
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result)
      const g = data.grid || {}
      if (!g.rows || !g.cols || !Array.isArray(g.cells)) {
        showNotice('导入失败：JSON 缺少 grid（rows/cols/cells）', true)
        return
      }
      if (!Array.isArray(data.exits) || !Array.isArray(data.agents)) {
        showNotice('导入失败：JSON 缺少 exits / agents 数组', true)
        return
      }
      applyScene({
        name: data.metadata?.name || '导入场景',
        gridData: g,
        exits: data.exits,
        agents: data.agents,
        settings: data.settings || null
      })
      showNotice(`场景已导入：${g.rows}×${g.cols}，${data.exits.length} 出口，${data.agents.length} 人员`)
    } catch {
      showNotice('导入失败：JSON 解析错误', true)
    }
  }
  reader.readAsText(file)
}

function onModeChange(m) {
  mode.value = m
  if (m === 'exit' || m === 'agent') error.value = ''
}

// ---------------- 保存场景（M2） ----------------
const showSave = ref(false)
const saveForm = ref({ name: '', description: '' })
const saveMsg = ref('')
const saveOk = ref(false)
const saving = ref(false)

function openSaveScene() {
  if (!window.api?.scenario?.save) {
    showNotice('请在 Electron 桌面应用中使用「保存场景」（浏览器模式不可用）', true)
    return
  }
  saveForm.value = { name: '', description: '' }
  saveMsg.value = ''
  saveOk.value = false
  showSave.value = true
}

async function onSubmitSave() {
  saveMsg.value = ''
  saveOk.value = false
  if (!saveForm.value.name.trim()) {
    saveMsg.value = '场景名称不能为空'
    return
  }
  saving.value = true
  try {
    const res = await window.api.scenario.save({
      name: saveForm.value.name.trim(),
      description: saveForm.value.description.trim(),
      gridData: { rows: rows.value, cols: cols.value, cells: cells.value },
      exits: exits.value,
      agents: agents.value,
      settings: { algorithm: algorithm.value }
    })
    if (res?.success) {
      saveMsg.value = '保存成功'
      saveOk.value = true
      showNotice(`场景已保存（#${res.id}）`)
      setTimeout(() => (showSave.value = false), 600)
    } else {
      saveMsg.value = res?.message || '保存失败'
    }
  } catch {
    saveMsg.value = '保存过程出现异常'
  } finally {
    saving.value = false
  }
}

// ---------------- 批量算法对比（M3） ----------------
const showBatch = ref(false)
const batchRows = ref([])
const batchRunning = ref(false)
const batchProgress = ref('')
const batchErr = ref('')

function openBatchCompare() {
  if (!exits.value.length || !agents.value.length) {
    showNotice('请先布置出口和人员再对比', true)
    return
  }
  showBatch.value = true
  batchRows.value = []
  batchErr.value = ''
}

async function runBatchCompare() {
  batchRunning.value = true
  batchErr.value = ''
  batchRows.value = []
  try {
    for (let i = 0; i < algorithms.value.length; i++) {
      const a = algorithms.value[i]
      batchProgress.value = `${a.label}（${i + 1}/${algorithms.value.length}）`
      try {
        const data = await runSimulation({
          grid: cells.value,
          exits: exits.value,
          agents: agents.value,
          algorithm: a.id
        })
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

function exportBatchCsv() {
  const head = '算法,耗时(ms),总步数,平均,最长,不可达\n'
  const lines = batchRows.value.map((r) => `${r.label},${r.computationTime},${r.totalSteps},${r.avgPathLength},${r.maxPathLength},${r.unreachableCount}`)
  downloadFile(`bsess_batch_${Date.now()}.csv`, '\uFEFF' + head + lines.join('\n'), 'text/csv')
}

function exportBatchJson() {
  downloadFile(
    `bsess_batch_${Date.now()}.json`,
    JSON.stringify({ rows: rows.value, cols: cols.value, exportedAt: new Date().toISOString(), results: batchRows.value }, null, 2),
    'application/json'
  )
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

// ---------------- 挂载：加载场景 or 示例 ----------------
onMounted(async () => {
  await initBackendUrl()
  fetchAlgorithms()
  const pending = takePendingScene()
  if (pending) {
    applyScene(pending)
    showNotice(`已加载场景：${pending.name}`)
  } else {
    buildSampleScene()
  }
})

/** 应用一个已保存场景（来自场景管理页） */
function applyScene(scene) {
  const g = scene.gridData || {}
  rows.value = g.rows || 20
  cols.value = g.cols || 30
  cells.value = Array.isArray(g.cells) && g.cells.length ? g.cells.map((r) => [...r]) : Array.from({ length: rows.value }, () => Array(cols.value).fill(0))
  exits.value = (scene.exits || []).map((e) => ({ row: e.row, col: e.col }))
  agents.value = (scene.agents || []).map((a) => ({ row: a.row, col: a.col }))
  if (scene.settings?.algorithm) algorithm.value = scene.settings.algorithm
  stats.value = null
  clearHeatmapState()
  renderScene()
}

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
  align-items: center;
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
  flex: 1;
}
.header-actions {
  display: flex;
  gap: 8px;
}
.btn {
  padding: 6px 12px;
  border: 1px solid #d4d9e0;
  border-radius: 8px;
  background: #fff;
  font-size: 13px;
  cursor: pointer;
}
.btn:hover {
  border-color: #378add;
  color: #185fa5;
}
.btn.active {
  border-color: #185fa5;
  background: #e6f1fb;
  color: #185fa5;
}
.btn.primary {
  background: #185fa5;
  border-color: #185fa5;
  color: #fff;
}
.btn.primary:hover {
  background: #0c447c;
  color: #fff;
}
.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.notice {
  position: fixed;
  top: 66px;
  left: 50%;
  transform: translateX(-50%);
  background: #eaf3de;
  color: #3b6d11;
  border: 1px solid #c0dd97;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 13px;
  z-index: 200;
}
.notice.err {
  background: #fcebeb;
  color: #a32d2d;
  border-color: #f7c1c1;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
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
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.modal-box {
  width: 380px;
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
}
.modal-box.wide {
  width: 560px;
}
.modal-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 16px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 14px;
  font-size: 13px;
  color: #4e5969;
}
.input {
  padding: 7px 10px;
  border: 1px solid #d4d9e0;
  border-radius: 8px;
  font-size: 13px;
  font-family: inherit;
}
.msg {
  font-size: 13px;
  color: #2ecc71;
  margin: 0 0 12px;
}
.msg.err {
  color: #a32d2d;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 4px;
}
.cmp-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  margin-bottom: 12px;
}
.cmp-table th,
.cmp-table td {
  text-align: left;
  padding: 7px 10px;
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
.hint {
  font-size: 12px;
  color: #8a9099;
  margin: 0 0 12px;
}
</style>
