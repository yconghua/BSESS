<template>
  <FunctionPage title="热力诊断" sub="叠加距离场热力图，识别最远区域与不可达点" tall>
    <template #actions>
      <button class="fp-btn" :class="{ active: s.heatmapOn }" @click="ws.toggleHeatmap">
        {{ s.heatmapOn ? '关闭热力图' : '叠加热力图' }}
      </button>
    </template>

    <template #side>
      <div class="fp-card">
        <h3 class="fp-card-title">诊断结果</h3>
        <div v-if="!s.result?.distanceField" class="fp-hint">暂无距离场数据，先运行一次疏散。</div>
        <template v-else>
          <div class="diag-item">
            <span class="diag-label">最远可达格</span>
            <span class="diag-val">{{ farthest.length ? farthest.map((f) => `(${f.row},${f.col})`).join(' ') : '—' }}</span>
          </div>
          <div class="diag-item">
            <span class="diag-label">最大距离</span>
            <span class="diag-val">{{ maxDist }} 步</span>
          </div>
          <div class="diag-item">
            <span class="diag-label">不可达格</span>
            <span class="diag-val" :class="{ red: unreachableCount > 0 }">{{ unreachableCount }} 格</span>
          </div>
          <p class="fp-hint">
            颜色说明：蓝（近出口）→ 红（远）；深紫 = 不可达。最远格所在区域通常是最后被疏散、易拥堵的瓶颈区。
          </p>
        </template>
      </div>
    </template>

    <div class="canvas-wrap"><SceneCanvas /></div>
  </FunctionPage>
</template>

<script setup>
// 分析 · 热力诊断：距离场热力图 + 瓶颈识别
import { computed } from 'vue'
import FunctionPage from '@/components/FunctionPage.vue'
import SceneCanvas from '@/components/evacuation/SceneCanvas.vue'
import { useWorkspace } from '@/composables/useWorkspace'

const ws = useWorkspace()
const s = ws.state
const INF = 10 ** 9

const df = computed(() => s.result?.distanceField || null)

const maxDist = computed(() => {
  const d = df.value
  if (!d) return 0
  let m = 0
  for (const row of d) for (const v of row) if (v < INF && v > m) m = v
  return m
})

const farthest = computed(() => {
  const d = df.value
  if (!d || !maxDist.value) return []
  const out = []
  d.forEach((row, r) => row.forEach((v, c) => {
    if (v === maxDist.value) out.push({ row: r, col: c })
  }))
  return out.slice(0, 5)
})

const unreachableCount = computed(() => {
  const d = df.value
  if (!d) return 0
  return d.flat().filter((v) => v >= INF).length
})
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
.diag-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 0;
  border-bottom: 1px dashed #eceff3;
  font-size: 13px;
}
.diag-label {
  color: #8a9099;
  font-size: 12px;
}
.diag-val {
  color: #1d2129;
  font-weight: 600;
  word-break: break-all;
}
.diag-val.red {
  color: #a32d2d;
}
</style>
