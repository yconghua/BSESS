<template>
  <div class="tree">
    <!-- 空间 -->
    <div class="node">
      <div class="node-head" :class="{ active: selected?.type === 'space' }" @click="selectSpace">
        <span class="caret">▸</span>
        <span class="node-icon" style="background:#185fa5">间</span>
        <span class="node-name">空间</span>
        <span class="node-count">{{ s.rows }}×{{ s.cols }}</span>
      </div>
    </div>

    <!-- 障碍物 -->
    <div class="node">
      <div class="node-head" :class="{ active: isOpen('obstacle') }" @click="toggle('obstacle')">
        <span class="caret" :class="{ open: isOpen('obstacle') }">▸</span>
        <span class="node-icon" style="background:#555b66">障</span>
        <span class="node-name">障碍物</span>
        <span class="node-count">{{ obstacles.length }}</span>
      </div>
      <div v-show="isOpen('obstacle')" class="node-children">
        <div
          v-for="(o, i) in obstacles"
          :key="i"
          class="leaf"
          :class="{ active: isSel('obstacle', i) }"
          @click="selectEntity('obstacle', i)"
        >
          <span class="leaf-name">障碍 {{ i + 1 }}</span>
          <span class="leaf-info">({{ o.row }},{{ o.col }})</span>
        </div>
        <div v-if="!obstacles.length" class="leaf empty">暂无障碍</div>
      </div>
    </div>

    <!-- 出口 -->
    <div class="node">
      <div class="node-head" :class="{ active: isOpen('exit') }" @click="toggle('exit')">
        <span class="caret" :class="{ open: isOpen('exit') }">▸</span>
        <span class="node-icon" style="background:#2ecc71">口</span>
        <span class="node-name">出口</span>
        <span class="node-count">{{ s.exits.length }}</span>
      </div>
      <div v-show="isOpen('exit')" class="node-children">
        <div
          v-for="(e, i) in s.exits"
          :key="i"
          class="leaf"
          :class="{ active: isSel('exit', i) }"
          @click="selectEntity('exit', i)"
        >
          <span class="leaf-name">出口 {{ i + 1 }}</span>
          <span class="leaf-info">{{ exitShare(e) }}</span>
        </div>
        <div v-if="!s.exits.length" class="leaf empty">暂无出口</div>
      </div>
    </div>

    <!-- 人员 -->
    <div class="node">
      <div class="node-head" :class="{ active: isOpen('agent') }" @click="toggle('agent')">
        <span class="caret" :class="{ open: isOpen('agent') }">▸</span>
        <span class="node-icon" style="background:#3498db">人</span>
        <span class="node-name">人员</span>
        <span class="node-count">{{ s.agents.length }}</span>
      </div>
      <div v-show="isOpen('agent')" class="node-children">
        <div
          v-for="(a, i) in s.agents"
          :key="i"
          class="leaf"
          :class="{ active: isSel('agent', i) }"
          @click="selectEntity('agent', i)"
        >
          <span class="leaf-name">人员 {{ i + 1 }}</span>
          <span class="leaf-info">{{ agentStatus(i) }}</span>
        </div>
        <div v-if="!s.agents.length" class="leaf empty">暂无人员</div>
      </div>
    </div>

    <!-- 仿真 -->
    <div class="node">
      <div class="node-head" :class="{ active: selected?.type === 'sim' }" @click="selectType('sim')">
        <span class="caret">▸</span>
        <span class="node-icon" style="background:#0f6e56">仿</span>
        <span class="node-name">仿真</span>
        <span class="node-count">{{ s.evacActive ? '播放中' : (s.result ? '已运行' : '') }}</span>
      </div>
    </div>

    <!-- 结果 -->
    <div class="node">
      <div class="node-head" :class="{ active: selected?.type === 'result' }" @click="selectType('result')">
        <span class="caret" :class="{ open: selected?.type === 'result' }">▸</span>
        <span class="node-icon" style="background:#7f77dd">果</span>
        <span class="node-name">结果</span>
        <span class="node-count">{{ hasResult ? '有' : '' }}</span>
      </div>
      <div v-show="selected?.type === 'result'" class="node-children">
        <div class="leaf" :class="{ active: selected?.sub === 'report' }" @click="selectSub('report')">统计报表</div>
        <div class="leaf" :class="{ active: selected?.sub === 'paths' }" @click="selectSub('paths')">路径查看</div>
        <div class="leaf" :class="{ active: selected?.sub === 'heatmap' }" @click="selectSub('heatmap')">热力诊断</div>
        <div class="leaf" :class="{ active: selected?.sub === 'split' }" @click="selectSub('split')">出口分流</div>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * EntityTree —— 工作台左侧对象树。
 * 六个顶层节点（空间/障碍物/出口/人员/仿真/结果），实体节点支持点击定位与高亮。
 */
import { computed, ref } from 'vue'
import { useWorkspace } from '@/composables/useWorkspace'

const ws = useWorkspace()
const s = ws.state

const props = defineProps({
  selected: { type: Object, default: null }
})
const emit = defineEmits(['select'])

const openGroups = ref({ obstacle: true, exit: true, agent: false })

const obstacles = computed(() => {
  const list = []
  s.cells.forEach((row, r) => row.forEach((v, c) => {
    if (v === 1) list.push({ row: r, col: c })
  }))
  return list
})
const hasResult = computed(() => !!s.result)

function isOpen(key) {
  return openGroups.value[key]
}
function toggle(key) {
  openGroups.value[key] = !openGroups.value[key]
}
function isSel(type, index) {
  return props.selected?.type === type && props.selected?.index === index
}
function selectSpace() {
  emit('select', { type: 'space' })
}
function selectType(type) {
  emit('select', { type })
}
function selectSub(sub) {
  emit('select', { type: 'result', sub })
}
function selectEntity(type, index) {
  emit('select', { type, index })
}

function exitShare(e) {
  if (!s.result?.stats?.exitDistribution) return ''
  const item = s.result.stats.exitDistribution.find((x) => x.row === e.row && x.col === e.col)
  return item ? `${item.count}人` : ''
}

function agentStatus(i) {
  const p = s.result?.agentPaths?.[i]
  if (!p) return ''
  return p.length ? `${p.length - 1}步` : '不可达'
}
</script>

<style scoped>
.tree {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 13px;
}
.node-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  color: #1d2129;
}
.node-head:hover {
  background: #f5f7fa;
}
.node-head.active {
  background: #eef6ff;
  color: #185fa5;
}
.caret {
  width: 10px;
  font-size: 11px;
  color: #8a9099;
  transition: transform 0.2s;
  flex-shrink: 0;
}
.caret.open {
  transform: rotate(90deg);
}
.node-icon {
  width: 18px;
  height: 18px;
  border-radius: 5px;
  color: #fff;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.node-name {
  flex: 1;
  font-weight: 600;
}
.node-count {
  font-size: 11px;
  color: #8a9099;
  font-variant-numeric: tabular-nums;
}
.node-children {
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin-left: 20px;
  padding-left: 10px;
  border-left: 1px solid #eceff3;
}
.leaf {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 5px 10px;
  border-radius: 6px;
  cursor: pointer;
  color: #4e5969;
  font-size: 12px;
}
.leaf:hover {
  background: #f5f7fa;
}
.leaf.active {
  background: #eef6ff;
  color: #185fa5;
  font-weight: 600;
}
.leaf.empty {
  color: #b9c0cc;
  cursor: default;
}
.leaf-info {
  color: #8a9099;
  font-variant-numeric: tabular-nums;
}
</style>
