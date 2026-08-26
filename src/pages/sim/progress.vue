<template>
  <FunctionPage title="实时进度" sub="疏散完成百分比与当前步数（动画播放时实时刷新）" tall>
    <template #side>
      <div class="fp-card progress-card">
        <h3 class="fp-card-title">疏散进度</h3>
        <div class="big-num">{{ percent }}%</div>
        <div class="progress-track">
          <div class="progress-fill" :style="{ width: percent + '%' }"></div>
        </div>
        <p class="fp-hint">
          已疏散 <b>{{ s.evacDone }}</b>/{{ s.agents.length }} 人 · 步数 {{ s.evacStep }}/{{ s.evacTotal }}
        </p>
        <p class="fp-hint" :class="{ err: s.result?.stats?.unreachableCount > 0 }">
          不可达 {{ s.result?.stats?.unreachableCount ?? 0 }} 人
        </p>
        <div class="fp-row" style="margin-top:10px">
          <button class="fp-btn primary" style="flex:1" :disabled="s.evacActive" @click="ws.run">开始疏散</button>
          <button class="fp-btn" style="flex:1" @click="ws.reset">重置</button>
        </div>
      </div>
    </template>
    <div class="canvas-wrap">
      <SceneCanvas />
      <div v-if="s.evacActive" class="hud">
        <span v-if="s.evacDone >= s.agents.length" class="hud-done">疏散完成</span>
        <template v-else>已疏散 <b>{{ s.evacDone }}</b>/{{ s.agents.length }} 人</template>
      </div>
    </div>
  </FunctionPage>
</template>

<script setup>
// 仿真 · 实时进度：完成百分比 + 当前步数
import { computed } from 'vue'
import FunctionPage from '@/components/FunctionPage.vue'
import SceneCanvas from '@/components/evacuation/SceneCanvas.vue'
import { useWorkspace } from '@/composables/useWorkspace'

const ws = useWorkspace()
const s = ws.state

const percent = computed(() => {
  if (!s.agents.length) return 0
  return Math.round((s.evacDone / s.agents.length) * 100)
})
</script>

<style scoped>
.progress-card .big-num {
  font-size: 40px;
  font-weight: 700;
  color: #185fa5;
  text-align: center;
  margin: 6px 0 12px;
  font-variant-numeric: tabular-nums;
}
.progress-track {
  height: 14px;
  background: #f1f3f6;
  border-radius: 7px;
  overflow: hidden;
  margin-bottom: 12px;
}
.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #378add, #19a558);
  border-radius: 7px;
  transition: width 0.3s;
}
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
