<template>
  <FunctionPage title="过程控制" sub="暂停、继续、停止、重置动画及速度调节" tall>
    <template #side>
      <div class="fp-card">
        <h3 class="fp-card-title">播放控制</h3>
        <div class="fp-row">
          <button class="fp-btn primary" :disabled="!s.evacActive || s.paused" style="flex:1" @click="ws.pause">⏸ 暂停</button>
          <button class="fp-btn" :disabled="!s.paused" style="flex:1" @click="ws.resume">▶ 继续</button>
        </div>
        <div class="fp-row">
          <button class="fp-btn" :disabled="!s.evacActive" style="flex:1" @click="ws.stop">⏹ 停止</button>
          <button class="fp-btn" style="flex:1" @click="ws.reset">⟳ 重置</button>
        </div>
        <p class="fp-hint">状态：{{ s.evacActive ? (s.paused ? '已暂停' : '播放中') : '未运行' }} · 步 {{ s.evacStep }}/{{ s.evacTotal }}</p>
      </div>
      <div class="fp-card">
        <h3 class="fp-card-title">速度调节</h3>
        <select v-model="speedModel" class="fp-select" @change="ws.setSpeed(speedModel)">
          <option :value="350">慢（350ms/步）</option>
          <option :value="200">中（200ms/步）</option>
          <option :value="100">快（100ms/步）</option>
        </select>
        <p class="fp-hint">速度在动画播放期间也可实时调整（下次运行时生效）。</p>
      </div>
    </template>
    <div class="canvas-wrap">
      <SceneCanvas />
      <div v-if="s.evacActive" class="hud">
        <span v-if="s.evacDone >= s.agents.length" class="hud-done">疏散完成</span>
        <template v-else>已疏散 <b>{{ s.evacDone }}</b>/{{ s.agents.length }} 人 · 步 {{ s.evacStep }}/{{ s.evacTotal }}</template>
      </div>
    </div>
  </FunctionPage>
</template>

<script setup>
// 仿真 · 过程控制：暂停/继续/停止/重置 + 速度
import { ref } from 'vue'
import FunctionPage from '@/components/FunctionPage.vue'
import SceneCanvas from '@/components/evacuation/SceneCanvas.vue'
import { useWorkspace } from '@/composables/useWorkspace'

const ws = useWorkspace()
const s = ws.state
const speedModel = ref(s.speed)
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
</style>
