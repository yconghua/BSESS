<template>
  <div class="panel">
    <!-- 空间设置 -->
    <section class="panel-section">
      <h3 class="section-title">空间设置</h3>
      <div class="row">
        <label class="label">行</label>
        <input v-model.number="rowsInput" class="input" type="number" min="3" max="300" />
        <label class="label">列</label>
        <input v-model.number="colsInput" class="input" type="number" min="3" max="300" />
      </div>
      <button class="btn btn-primary btn-block" @click="emit('generate', { rows: rowsInput, cols: colsInput })">
        生成网格
      </button>
    </section>

    <!-- 绘制模式 -->
    <section class="panel-section">
      <h3 class="section-title">绘制模式</h3>
      <div class="mode-grid">
        <button
          v-for="m in MODES"
          :key="m.key"
          class="mode-btn"
          :class="{ active: mode === m.key }"
          @click="emit('update:mode', m.key)"
        >
          <span class="mode-dot" :style="{ background: m.color }"></span>{{ m.label }}
        </button>
      </div>
      <p class="hint">点击 3D 场景中的格子进行涂绘（左键拖动为旋转视角）</p>
    </section>

    <!-- 人员快捷操作 -->
    <section class="panel-section">
      <h3 class="section-title">人员快捷操作</h3>
      <div class="row">
        <label class="label">随机</label>
        <input v-model.number="randomCount" class="input" type="number" min="1" max="500" />
        <button class="btn" @click="emit('random-agents', randomCount)">生成</button>
      </div>
      <div class="row">
        <button class="btn btn-sm" @click="emit('clear-agents')">清空人员</button>
        <button class="btn btn-sm" @click="emit('clear-obstacles')">清空障碍</button>
      </div>
      <p class="hint">当前：障碍 {{ obstaclesCount }} 格 · 出口 {{ exitsCount }} · 人员 {{ agentsCount }}</p>
    </section>

    <!-- 算法选择 -->
    <section class="panel-section">
      <h3 class="section-title">算法选择</h3>
      <select v-model="algorithmModel" class="select" @change="emit('update:algorithm', algorithmModel)">
        <option v-for="a in algorithms" :key="a.id" :value="a.id">
          {{ a.label }}{{ a.recommended ? '（推荐）' : '' }}
        </option>
      </select>
      <p v-if="currentAlgo" class="hint">{{ currentAlgo.scenario }}</p>
    </section>

    <!-- 仿真控制 -->
    <section class="panel-section">
      <h3 class="section-title">仿真控制</h3>
      <div class="row">
        <button class="btn btn-primary" :disabled="loading" @click="emit('start', speed)">
          {{ loading ? '计算中…' : '▶ 开始疏散' }}
        </button>
        <button class="btn" @click="emit('reset')">⟳ 重置</button>
      </div>
      <div class="row">
        <label class="label">速度</label>
        <select v-model="speed" class="select">
          <option :value="350">慢</option>
          <option :value="200">中</option>
          <option :value="100">快</option>
        </select>
      </div>
    </section>

    <!-- 错误提示 -->
    <p v-if="error" class="error">{{ error }}</p>

    <!-- 统计结果 -->
    <section v-if="stats" class="panel-section">
      <h3 class="section-title">统计结果</h3>
      <ul class="stats">
        <li>总耗时（步）<span>{{ stats.totalSteps }}</span></li>
        <li>平均路径 <span>{{ stats.avgPathLength }}</span></li>
        <li>最长路径 <span>{{ stats.maxPathLength }}</span></li>
        <li>不可达 <span class="warn">{{ stats.unreachableCount }}</span></li>
        <li>计算耗时 <span>{{ stats.computationTime ?? resultMs }} ms</span></li>
      </ul>
      <div class="exit-dist">
        <div v-for="e in stats.exitDistribution" :key="`${e.row}-${e.col}`" class="exit-item">
          出口({{ e.row }},{{ e.col }})：{{ e.count }} 人
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
/**
 * ControlPanel —— 左侧控制面板（M0）。
 * 数据流：输入/按钮 → emit 事件给页面编排器；统计/算法列表通过 props 下发。
 */
import { computed, ref } from 'vue'

// 绘制模式（颜色用于面板上的小圆点标识，与 GridCanvas 配色一致）
const MODES = [
  { key: 'obstacle', label: '障碍物', color: '#555b66' },
  { key: 'exit', label: '出口', color: '#2ecc71' },
  { key: 'agent', label: '人员', color: '#3498db' },
  { key: 'erase', label: '清除', color: '#e74c3c' }
]

const props = defineProps({
  rows: { type: Number, default: 20 },
  cols: { type: Number, default: 30 },
  mode: { type: String, default: 'obstacle' },
  algorithm: { type: String, default: 'distanceField' },
  algorithms: { type: Array, default: () => [] },
  agentsCount: { type: Number, default: 0 },
  exitsCount: { type: Number, default: 0 },
  obstaclesCount: { type: Number, default: 0 },
  stats: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  resultMs: { type: Number, default: 0 }
})
const emit = defineEmits([
  'generate', 'update:mode', 'update:algorithm',
  'random-agents', 'clear-agents', 'clear-obstacles',
  'start', 'reset'
])

const rowsInput = ref(props.rows)
const colsInput = ref(props.cols)
const randomCount = ref(50)
const speed = ref(200)
// 算法下拉用本地副本：受控于 prop（父组件重置时同步）
const algorithmModel = ref(props.algorithm)

const currentAlgo = computed(() => props.algorithms.find((a) => a.id === algorithmModel.value))
</script>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.panel-section {
  background: #fff;
  border: 1px solid #e6e9ef;
  border-radius: 10px;
  padding: 12px 14px;
}
.section-title {
  font-size: 13px;
  font-weight: 600;
  color: #3a3f47;
  margin: 0 0 10px;
}
.row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}
.row:last-child {
  margin-bottom: 0;
}
.label {
  font-size: 12px;
  color: #6a7078;
  white-space: nowrap;
}
.input {
  width: 60px;
  padding: 4px 6px;
  border: 1px solid #d4d9e0;
  border-radius: 6px;
  font-size: 13px;
}
.select {
  width: 100%;
  padding: 5px 6px;
  border: 1px solid #d4d9e0;
  border-radius: 6px;
  font-size: 13px;
  background: #fff;
}
.btn {
  padding: 6px 12px;
  border: 1px solid #d4d9e0;
  border-radius: 6px;
  background: #fff;
  font-size: 13px;
  cursor: pointer;
}
.btn:hover {
  border-color: #378add;
  color: #185fa5;
}
.btn-primary {
  background: #185fa5;
  border-color: #185fa5;
  color: #fff;
}
.btn-primary:hover {
  background: #0c447c;
  color: #fff;
}
.btn-primary:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.btn-block {
  width: 100%;
  margin-top: 4px;
}
.btn-sm {
  font-size: 12px;
  padding: 4px 10px;
}
.mode-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
}
.mode-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border: 1px solid #d4d9e0;
  border-radius: 6px;
  background: #fff;
  font-size: 13px;
  cursor: pointer;
}
.mode-btn.active {
  border-color: #185fa5;
  background: #e6f1fb;
  color: #185fa5;
}
.mode-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}
.hint {
  font-size: 12px;
  color: #8a9099;
  margin: 8px 0 0;
  line-height: 1.5;
}
.error {
  font-size: 12px;
  color: #a32d2d;
  background: #fcebeb;
  border: 1px solid #f7c1c1;
  border-radius: 8px;
  padding: 8px 10px;
  margin: 0;
}
.stats {
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 13px;
}
.stats li {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  border-bottom: 1px dashed #eceff3;
}
.stats li:last-child {
  border-bottom: none;
}
.stats span {
  font-weight: 600;
  color: #3a3f47;
}
.stats .warn {
  color: #a32d2d;
}
.exit-dist {
  margin-top: 8px;
  font-size: 12px;
  color: #6a7078;
}
.exit-item {
  padding: 2px 0;
}
</style>
