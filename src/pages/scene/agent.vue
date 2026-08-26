<template>
  <FunctionPage title="人员设定" sub="手动放置或随机生成疏散人员起点（蓝色小球）" tall>
    <template #side>
      <div class="fp-card">
        <h3 class="fp-card-title">手动放置</h3>
        <div class="fp-row">
          <button class="fp-btn" :class="{ active: s.mode === 'agent' }" style="flex:1" @click="s.mode = 'agent'">放置人员</button>
          <button class="fp-btn" :class="{ active: s.mode === 'erase' }" style="flex:1" @click="s.mode = 'erase'">清除</button>
        </div>
        <p class="fp-hint">「放置人员」点击空地格添加人员（再点一次移除）；人员不能落在障碍或出口上。</p>
      </div>
      <div class="fp-card">
        <h3 class="fp-card-title">随机生成</h3>
        <div class="fp-row">
          <span class="fp-label">人数</span>
          <input v-model.number="count" class="fp-input" type="number" min="1" max="500" />
          <button class="fp-btn primary" @click="ws.randomAgents(count)">生成</button>
        </div>
        <button class="fp-btn" style="width:100%" @click="ws.clearAgents">清空全部人员</button>
        <p class="fp-hint">随机生成只落在空地，不与出口 / 已有人员重叠。当前人员 {{ s.agents.length }} 人。</p>
      </div>
    </template>
    <div class="canvas-wrap"><SceneCanvas /></div>
  </FunctionPage>
</template>

<script setup>
// 场景 · 人员设定：手动放置 / 随机生成人员起点
import { onMounted, ref } from 'vue'
import FunctionPage from '@/components/FunctionPage.vue'
import SceneCanvas from '@/components/evacuation/SceneCanvas.vue'
import { useWorkspace } from '@/composables/useWorkspace'

const ws = useWorkspace()
const s = ws.state
const count = ref(50)

onMounted(() => {
  s.mode = 'agent'
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
