<template>
  <FunctionPage title="障碍布置" sub="点击 3D 场景中的格子放置 / 清除障碍物" tall>
    <template #side>
      <div class="fp-card">
        <h3 class="fp-card-title">绘制模式</h3>
        <div class="fp-row">
          <button class="fp-btn" :class="{ active: s.mode === 'obstacle' }" style="flex:1" @click="s.mode = 'obstacle'">放置障碍</button>
          <button class="fp-btn" :class="{ active: s.mode === 'erase' }" style="flex:1" @click="s.mode = 'erase'">清除</button>
        </div>
        <p class="fp-hint">「放置障碍」点击空地格变为障碍（深灰方块）；「清除」点击恢复为空地。障碍格上的出口与人员会被移走。</p>
      </div>
      <div class="fp-card">
        <h3 class="fp-card-title">批量操作</h3>
        <button class="fp-btn" style="width:100%" @click="ws.clearObstacles">清空全部障碍</button>
        <p class="fp-hint">当前障碍 {{ obstacleCount }} 格（总 {{ s.rows * s.cols }} 格）</p>
      </div>
    </template>
    <div class="canvas-wrap"><SceneCanvas /></div>
  </FunctionPage>
</template>

<script setup>
// 场景 · 障碍布置：放置 / 清除障碍物
import { computed, onMounted } from 'vue'
import FunctionPage from '@/components/FunctionPage.vue'
import SceneCanvas from '@/components/evacuation/SceneCanvas.vue'
import { useWorkspace } from '@/composables/useWorkspace'

const ws = useWorkspace()
const s = ws.state
const obstacleCount = computed(() => s.cells.flat().filter((v) => v === 1).length)

onMounted(() => {
  s.mode = 'obstacle'
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
</style>
