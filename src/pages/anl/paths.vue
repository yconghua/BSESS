<template>
  <FunctionPage title="路径查看" sub="逐条查看人员路径详情与轨迹（彩色折线）" tall>
    <template #actions>
      <button class="fp-btn" :class="{ active: s.pathLinesOn }" @click="ws.togglePathLines">
        {{ s.pathLinesOn ? '隐藏路径线' : '显示路径线' }}
      </button>
      <button class="fp-btn" :disabled="!s.result" @click="exportJson">导出路径 JSON</button>
    </template>

    <template #side>
      <div class="fp-card">
        <h3 class="fp-card-title">人员路径（{{ list.length }}）</h3>
        <div v-if="!s.result" class="fp-hint">暂无结果，先运行一次疏散。</div>
        <div v-else class="path-list">
          <div v-for="item in list" :key="item.idx" class="path-item">
            <span class="path-idx">#{{ item.idx }}</span>
            <span class="path-info">起点({{ item.start.row }},{{ item.start.col }})</span>
            <span class="path-info">{{ item.reachable ? `出口(${item.end.row},${item.end.col})·${item.steps}步` : '不可达' }}</span>
            <span class="path-badge" :class="item.reachable ? 'on' : 'off'">{{ item.reachable ? '可达' : '不可达' }}</span>
          </div>
        </div>
      </div>
    </template>

    <div class="canvas-wrap"><SceneCanvas /></div>
  </FunctionPage>
</template>

<script setup>
// 分析 · 路径查看：逐条路径详情 + 3D 折线
import { computed } from 'vue'
import FunctionPage from '@/components/FunctionPage.vue'
import SceneCanvas from '@/components/evacuation/SceneCanvas.vue'
import { useWorkspace } from '@/composables/useWorkspace'

const ws = useWorkspace()
const s = ws.state

const list = computed(() => {
  const paths = s.result?.agentPaths || []
  return paths.map((p, i) => {
    const start = s.agents[i] || { row: '-', col: '-' }
    const reachable = !!p && p.length > 0
    return {
      idx: i + 1,
      start,
      end: reachable ? p[p.length - 1] : null,
      steps: reachable ? p.length - 1 : 0,
      reachable
    }
  })
})

function exportJson() {
  const payload = JSON.stringify({ agents: s.agents, agentPaths: s.result.agentPaths }, null, 2)
  const blob = new Blob([payload], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `bsess_paths_${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.canvas-wrap {
  position: absolute;
  inset: 0;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid #e6e9ef;
  background: #f5f6f9;
}
.path-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 480px;
  overflow-y: auto;
}
.path-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  padding: 5px 0;
  border-bottom: 1px dashed #eceff3;
}
.path-idx {
  width: 28px;
  font-weight: 600;
  color: #185fa5;
  flex-shrink: 0;
}
.path-info {
  flex: 1;
  min-width: 0;
  color: #4e5969;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.path-badge {
  font-size: 11px;
  border-radius: 10px;
  padding: 1px 8px;
  flex-shrink: 0;
}
.path-badge.on {
  background: #eaf3de;
  color: #3b6d11;
}
.path-badge.off {
  background: #fcebeb;
  color: #a32d2d;
}
</style>
