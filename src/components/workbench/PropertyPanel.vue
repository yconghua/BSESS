<template>
  <div class="panel">
    <!-- ============ 空间 / 全局 ============ -->
    <template v-if="sel?.type === 'space' || sel?.type === 'global'">
      <div class="fp-card">
        <h3 class="fp-card-title">空间参数</h3>
        <div class="fp-row">
          <span class="fp-label" style="width:34px">行数</span>
          <input v-model.number="rowsInput" class="fp-input" type="number" min="3" max="300" />
        </div>
        <div class="fp-row">
          <span class="fp-label" style="width:34px">列数</span>
          <input v-model.number="colsInput" class="fp-input" type="number" min="3" max="300" />
        </div>
        <button class="fp-btn primary" style="width:100%" @click="onGenerate">生成 / 重建空间</button>
      </div>
      <div class="fp-card">
        <h3 class="fp-card-title">绘制工具</h3>
        <div class="mode-grid">
          <button v-for="m in MODES" :key="m.key" class="fp-btn" :class="{ active: s.mode === m.key }" @click="s.mode = m.key">
            {{ m.label }}
          </button>
        </div>
        <div class="fp-row" style="margin-top:8px">
          <span class="fp-label">随机</span>
          <input v-model.number="randomN" class="fp-input" type="number" min="1" max="500" />
          <button class="fp-btn primary" @click="ws.randomAgents(randomN)">生成人员</button>
        </div>
        <button class="fp-btn" style="width:100%" @click="ws.clearAgents">清空人员</button>
        <button class="fp-btn" style="width:100%; margin-top:6px" @click="ws.clearObstacles">清空障碍</button>
      </div>
      <div class="fp-card">
        <h3 class="fp-card-title">全局概览</h3>
        <p class="fp-hint">{{ s.rows }}×{{ s.cols }} 网格 · 障碍 {{ obstacleCount }} 格 · 出口 {{ s.exits.length }} · 人员 {{ s.agents.length }}</p>
        <p v-if="s.result" class="fp-hint">最近结果：总步数 {{ s.result.stats.totalSteps }} · 平均 {{ s.result.stats.avgPathLength }} · 不可达 {{ s.result.stats.unreachableCount }}</p>
        <button class="fp-btn" style="width:100%" @click="saveScene">保存到场景库</button>
      </div>
    </template>

    <!-- ============ 障碍物 ============ -->
    <template v-else-if="sel?.type === 'obstacle'">
      <div class="fp-card">
        <h3 class="fp-card-title">障碍物 #{{ sel.index + 1 }}</h3>
        <p class="fp-hint">坐标：（{{ obstacle.row }}，{{ obstacle.col }}）· 尺寸：1×1 格 · 不可通行</p>
        <button class="fp-btn danger" style="width:100%" @click="removeAt(obstacle.row, obstacle.col)">删除该障碍</button>
        <button class="fp-btn" style="width:100%; margin-top:6px" @click="ws.clearObstacles">清空全部障碍</button>
      </div>
    </template>

    <!-- ============ 出口 ============ -->
    <template v-else-if="sel?.type === 'exit'">
      <div class="fp-card">
        <h3 class="fp-card-title">出口 #{{ sel.index + 1 }}</h3>
        <p class="fp-hint">坐标：（{{ exit.row }}，{{ exit.col }}）</p>
        <p class="fp-hint">
          已疏散人数：<b>{{ exitCount }}</b> 人（{{ exitPct }}）<span v-if="!s.result">（尚未仿真）</span>
        </p>
        <button class="fp-btn danger" style="width:100%" @click="removeAt(exit.row, exit.col)">移除该出口</button>
      </div>
    </template>

    <!-- ============ 人员 ============ -->
    <template v-else-if="sel?.type === 'agent'">
      <div class="fp-card">
        <h3 class="fp-card-title">人员 #{{ sel.index + 1 }}</h3>
        <p class="fp-hint">起点：（{{ agent.row }}，{{ agent.col }}）</p>
        <div v-if="agentPath" class="path-info">
          <p class="fp-hint" :class="{ err: !agentReachable }">
            {{ agentReachable ? `已到达出口 (${agentPath[agentPath.length - 1].row.toFixed?.(2) ?? agentPath[agentPath.length - 1].row},${agentPath[agentPath.length - 1].col.toFixed?.(2) ?? agentPath[agentPath.length - 1].col}) · ${agentPath.length - 1} 步` : '不可达：该起点被障碍包围或无法到达任何出口' }}
          </p>
          <p class="fp-hint">轨迹点数：{{ agentPath.length }}（CA/SFM 含等待点）</p>
        </div>
        <p v-else class="fp-hint">尚无轨迹，运行仿真后可在此查看路径详情。</p>
        <button class="fp-btn danger" style="width:100%" @click="removeAt(agent.row, agent.col)">移除该人员</button>
      </div>
    </template>

    <!-- ============ 仿真 ============ -->
    <template v-else-if="sel?.type === 'sim'">
      <div class="fp-card">
        <h3 class="fp-card-title">算法选择</h3>
        <select v-model="s.algorithm" class="fp-select">
          <option v-for="a in algorithms" :key="a.id" :value="a.id">{{ a.label }}</option>
        </select>
      </div>
      <div class="fp-card">
        <h3 class="fp-card-title">运行控制</h3>
        <div class="fp-row">
          <button class="fp-btn primary" :disabled="ws.loading || s.evacActive" style="flex:1" @click="ws.run">
            {{ ws.loading ? '计算中…' : '▶ 开始疏散' }}
          </button>
          <button class="fp-btn" :disabled="!s.evacActive || s.paused" @click="ws.pause">⏸</button>
          <button class="fp-btn" :disabled="!s.paused" @click="ws.resume">▶</button>
        </div>
        <div class="fp-row">
          <button class="fp-btn" :disabled="!s.evacActive" @click="ws.stop">⏹ 停止</button>
          <button class="fp-btn" @click="ws.reset">⟳ 重置</button>
        </div>
        <div class="fp-row">
          <span class="fp-label">速度</span>
          <select v-model="speedModel" class="fp-select" @change="ws.setSpeed(speedModel)">
            <option :value="350">慢</option>
            <option :value="200">中</option>
            <option :value="100">快</option>
          </select>
        </div>
        <p class="fp-hint" :class="{ err: s.result?.stats?.unreachableCount > 0 }">
          {{ s.evacActive ? `进度：已疏散 ${s.evacDone}/${s.agents.length} · 步 ${s.evacStep}/${s.evacTotal}` : (s.result ? `最近结果：makespan ${s.result.stats.totalSteps} · 不可达 ${s.result.stats.unreachableCount}` : '尚未运行，配置好后点「开始疏散」') }}
        </p>
      </div>
    </template>

    <!-- ============ 结果 ============ -->
    <template v-else-if="sel?.type === 'result'">
      <!-- 统计报表 -->
      <template v-if="!sel.sub || sel.sub === 'report'">
        <div class="fp-card">
          <h3 class="fp-card-title">统计报表</h3>
          <div v-if="!s.result" class="fp-hint">暂无仿真结果，先去「仿真」运行一次。</div>
          <template v-else>
            <div class="stat-row"><span>总步数（makespan）</span><b>{{ s.result.stats.totalSteps }}</b></div>
            <div class="stat-row"><span>平均路径</span><b>{{ s.result.stats.avgPathLength }}</b></div>
            <div class="stat-row"><span>最长路径</span><b>{{ s.result.stats.maxPathLength }}</b></div>
            <div class="stat-row"><span>不可达人数</span><b :class="{ red: s.result.stats.unreachableCount > 0 }">{{ s.result.stats.unreachableCount }}</b></div>
            <div class="stat-row"><span>计算耗时</span><b>{{ s.result.computationTime }} ms</b></div>
          </template>
        </div>
      </template>
      <!-- 路径查看 -->
      <template v-else-if="sel.sub === 'paths'">
        <div class="fp-card">
          <h3 class="fp-card-title">路径查看</h3>
          <button class="fp-btn" :class="{ active: s.pathLinesOn }" style="width:100%" @click="ws.togglePathLines">
            {{ s.pathLinesOn ? '隐藏路径线' : '显示全部路径线' }}
          </button>
          <div class="mini-list">
            <div v-if="!s.result" class="fp-hint">先运行仿真。</div>
            <div v-for="item in agentList" :key="item.idx" class="mini-item" @click="$emit('select', { type: 'agent', index: item.idx - 1 })">
              <span>#{{ item.idx }}</span>
              <span>{{ item.reachable ? `${item.steps}步` : '不可达' }}</span>
            </div>
          </div>
        </div>
      </template>
      <!-- 热力诊断 -->
      <template v-else-if="sel.sub === 'heatmap'">
        <div class="fp-card">
          <h3 class="fp-card-title">热力诊断</h3>
          <button class="fp-btn" :class="{ active: s.heatmapOn }" style="width:100%" @click="ws.toggleHeatmap">
            {{ s.heatmapOn ? '关闭热力图' : '叠加热力图' }}
          </button>
          <template v-if="s.result?.distanceField">
            <p class="fp-hint">最远可达格：{{ farthestText || '—' }}（{{ maxDist }} 步）</p>
            <p class="fp-hint" :class="{ err: unreachableCount > 0 }">不可达格：{{ unreachableCount }} 格</p>
          </template>
          <p v-else class="fp-hint">先运行仿真获取距离场。</p>
        </div>
      </template>
      <!-- 出口分流 -->
      <template v-else-if="sel.sub === 'split'">
        <div class="fp-card">
          <h3 class="fp-card-title">出口分流</h3>
          <div v-if="!s.result" class="fp-hint">先运行仿真。</div>
          <template v-else>
            <div v-for="e in s.result.stats.exitDistribution" :key="`${e.row}-${e.col}`" class="split-row">
              <span class="split-label">({{ e.row }},{{ e.col }})</span>
              <div class="split-track"><div class="split-fill" :style="{ width: splitPct(e.count) }"></div></div>
              <span class="split-val">{{ e.count }}人</span>
            </div>
          </template>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup>
/**
 * PropertyPanel —— 工作台右侧上下文属性面板。
 * 根据当前选中对象（空间/障碍/出口/人员/仿真/结果）动态渲染专属配置界面。
 */
import { computed, ref } from 'vue'
import { useWorkspace } from '@/composables/useWorkspace'

const ws = useWorkspace()
const s = ws.state
const algorithms = ws.algorithms

const props = defineProps({
  selected: { type: Object, default: null }
})
const emit = defineEmits(['select'])

const sel = computed(() => props.selected)
const MODES = [
  { key: 'select', label: '选择' },
  { key: 'obstacle', label: '障碍' },
  { key: 'exit', label: '出口' },
  { key: 'agent', label: '人员' },
  { key: 'erase', label: '清除' }
]

// 空间
const rowsInput = ref(s.rows)
const colsInput = ref(s.cols)
const randomN = ref(50)
const obstacleCount = computed(() => s.cells.flat().filter((v) => v === 1).length)

function onGenerate() {
  const r = Math.min(300, Math.max(3, rowsInput.value || 20))
  const c = Math.min(300, Math.max(3, colsInput.value || 30))
  ws.generate(r, c)
  ws.showNotice(`已生成 ${r}×${c} 疏散空间`)
}

async function saveScene() {
  if (!window.api?.scenario?.save) {
    ws.showNotice('保存到场景库依赖 MySQL，请在 Electron 桌面应用中使用', true)
    return
  }
  try {
    const res = await window.api.scenario.save({
      name: `${s.rows}×${s.cols} 场景 ${new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`,
      description: `障碍 ${obstacleCount.value} 格 · 出口 ${s.exits.length} · 人员 ${s.agents.length}`,
      gridData: { rows: s.rows, cols: s.cols, cells: s.cells },
      exits: s.exits,
      agents: s.agents,
      settings: { algorithm: s.algorithm }
    })
    if (res?.success) ws.showNotice(`场景已保存（#${res.id}）`)
    else ws.showNotice(res?.message || '保存失败', true)
  } catch {
    ws.showNotice('保存过程出现异常', true)
  }
}

// 障碍 / 出口 / 人员
const obstacle = computed(() => s.cells.flat().reduce((acc, v, idx) => {
  if (v === 1) {
    const row = Math.floor(idx / s.cols)
    const col = idx % s.cols
    if (acc.length <= props.selected?.index) acc.push({ row, col })
  }
  return acc
}, [])[props.selected?.index] || { row: '-', col: '-' })

const exit = computed(() => s.exits[props.selected?.index] || { row: '-', col: '-' })
const exitCount = computed(() => {
  if (!s.result?.stats?.exitDistribution) return 0
  const e = s.exits[props.selected?.index]
  if (!e) return 0
  return s.result.stats.exitDistribution.find((x) => x.row === e.row && x.col === e.col)?.count || 0
})
const exitPct = computed(() => (s.agents.length ? Math.round((exitCount.value / s.agents.length) * 100) + '%' : '0%'))

const agent = computed(() => s.agents[props.selected?.index] || { row: '-', col: '-' })
const agentPath = computed(() => s.result?.agentPaths?.[props.selected?.index] || null)
const agentReachable = computed(() => !!agentPath.value?.length)

/** 删除某格上的实体（借用 erase 涂绘逻辑：清格 + 移除其上出口/人员 + 失效结果） */
function removeAt(row, col) {
  s.mode = 'erase'
  ws.onCellClick({ row, col })
  s.mode = 'select'
  emit('select', { type: 'space' })
}

// 结果面板
const speedModel = ref(s.speed)
const agentList = computed(() => {
  const paths = s.result?.agentPaths || []
  return paths.map((p, i) => ({ idx: i + 1, steps: p?.length ? p.length - 1 : 0, reachable: !!p?.length }))
})
const INF = 10 ** 9
const maxDist = computed(() => {
  const d = s.result?.distanceField
  if (!d) return 0
  let m = 0
  for (const row of d) for (const v of row) if (v < INF && v > m) m = v
  return m
})
const farthestText = computed(() => {
  const d = s.result?.distanceField
  if (!d || !maxDist.value) return ''
  const out = []
  d.forEach((row, r) => row.forEach((v, c) => {
    if (v === maxDist.value && out.length < 3) out.push(`(${r},${c})`)
  }))
  return out.join(' ')
})
const unreachableCount = computed(() => {
  const d = s.result?.distanceField
  return d ? d.flat().filter((v) => v >= INF).length : 0
})
function splitPct(count) {
  return Math.round((count / (s.agents.length || 1)) * 100) + '%'
}
</script>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.mode-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}
.stat-row {
  display: flex;
  justify-content: space-between;
  padding: 5px 0;
  border-bottom: 1px dashed #eceff3;
  font-size: 13px;
  color: #4e5969;
}
.stat-row b {
  color: #1d2129;
}
.stat-row b.red {
  color: #a32d2d;
}
.path-info {
  background: #f7f8fa;
  border-radius: 8px;
  padding: 8px 10px;
  margin-bottom: 8px;
}
.mini-list {
  margin-top: 8px;
  max-height: 320px;
  overflow-y: auto;
}
.mini-item {
  display: flex;
  justify-content: space-between;
  padding: 4px 6px;
  font-size: 12px;
  color: #4e5969;
  cursor: pointer;
  border-radius: 6px;
}
.mini-item:hover {
  background: #f5f7fa;
}
.split-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  padding: 4px 0;
}
.split-label {
  width: 70px;
  color: #4e5969;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}
.split-track {
  flex: 1;
  height: 12px;
  background: #f1f3f6;
  border-radius: 6px;
  overflow: hidden;
}
.split-fill {
  height: 100%;
  background: linear-gradient(90deg, #2ecc71, #185fa5);
  border-radius: 6px;
  transition: width 0.4s;
}
.split-val {
  width: 44px;
  color: #6a7078;
  flex-shrink: 0;
  text-align: right;
}
</style>
