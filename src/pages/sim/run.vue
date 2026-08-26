<template>
  <FunctionPage title="疏散运行" sub="启动疏散计算并播放 3D 路径动画" tall>
    <template #side>
      <div class="fp-card">
        <h3 class="fp-card-title">运行设置</h3>
        <div class="fp-row">
          <span class="fp-label" style="width:34px">算法</span>
          <select v-model="s.algorithm" class="fp-select">
            <option v-for="a in algorithms" :key="a.id" :value="a.id">{{ a.label }}</option>
          </select>
        </div>
        <div class="fp-row">
          <span class="fp-label" style="width:34px">速度</span>
          <select v-model="speedModel" class="fp-select" @change="ws.setSpeed(speedModel)">
            <option :value="350">慢</option>
            <option :value="200">中</option>
            <option :value="100">快</option>
          </select>
        </div>
        <button class="fp-btn primary" style="width:100%" :disabled="ws.loading" @click="onRun">
          {{ ws.loading ? '计算中…' : '▶ 开始疏散' }}
        </button>
        <button class="fp-btn" style="width:100%; margin-top:8px" @click="ws.reset">⟳ 重置</button>
        <p class="fp-hint">开始前请确认已标记出口并布置人员；结果自动记入「仿真记录」，可在「分析」各页评估。</p>
      </div>
      <div class="fp-card">
        <h3 class="fp-card-title">当前场景</h3>
        <p class="fp-hint">{{ s.rows }}×{{ s.cols }} · 出口 {{ s.exits.length }} · 人员 {{ s.agents.length }} · 算法 {{ algoLabel }}</p>
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
// 仿真 · 疏散运行：启动计算并播放动画
import { computed, onMounted, ref } from 'vue'
import FunctionPage from '@/components/FunctionPage.vue'
import SceneCanvas from '@/components/evacuation/SceneCanvas.vue'
import { useWorkspace } from '@/composables/useWorkspace'

const ws = useWorkspace()
const s = ws.state
const algorithms = ws.algorithms
const speedModel = ref(s.speed)

const algoLabel = computed(() => algorithms.value.find((a) => a.id === s.algorithm)?.label || s.algorithm)

async function onRun() {
  const ok = await ws.run()
  if (ok) ws.showNotice('疏散完成，可在「分析」各页查看结果')
}

onMounted(() => ws.initBackend())
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
