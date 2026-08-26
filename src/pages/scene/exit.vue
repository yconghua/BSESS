<template>
  <FunctionPage title="出口标记" sub="标注一个或多个疏散出口（绿色发光块）" tall>
    <template #side>
      <div class="fp-card">
        <h3 class="fp-card-title">绘制模式</h3>
        <div class="fp-row">
          <button class="fp-btn" :class="{ active: s.mode === 'exit' }" style="flex:1" @click="s.mode = 'exit'">标记出口</button>
          <button class="fp-btn" :class="{ active: s.mode === 'erase' }" style="flex:1" @click="s.mode = 'erase'">清除</button>
        </div>
        <p class="fp-hint">点绿色为「标记出口」（再点一次取消）；点清除可移除。出口必须落在空地格上，建议放在边界处。</p>
      </div>
      <div class="fp-card">
        <h3 class="fp-card-title">当前出口（{{ s.exits.length }}）</h3>
        <p v-if="!s.exits.length" class="fp-hint err">尚未标记出口，疏散前至少需要 1 个。</p>
        <ul class="exit-list">
          <li v-for="(e, i) in s.exits" :key="i">
            出口 {{ i + 1 }}：（{{ e.row }}，{{ e.col }}）
            <button class="link-btn" @click="removeExit(i)">移除</button>
          </li>
        </ul>
      </div>
    </template>
    <div class="canvas-wrap"><SceneCanvas /></div>
  </FunctionPage>
</template>

<script setup>
// 场景 · 出口标记：标注一个或多个出口
import { onMounted } from 'vue'
import FunctionPage from '@/components/FunctionPage.vue'
import SceneCanvas from '@/components/evacuation/SceneCanvas.vue'
import { useWorkspace } from '@/composables/useWorkspace'

const ws = useWorkspace()
const s = ws.state

function removeExit(i) {
  s.exits.splice(i, 1)
  ws.renderScene()
}

onMounted(() => {
  s.mode = 'exit'
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
.exit-list {
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 13px;
}
.exit-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 0;
  border-bottom: 1px dashed #eceff3;
}
.link-btn {
  border: none;
  background: none;
  color: #a32d2d;
  font-size: 12px;
  cursor: pointer;
  padding: 0;
}
</style>
