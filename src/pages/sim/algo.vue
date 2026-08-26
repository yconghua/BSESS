<template>
  <FunctionPage title="算法选择" sub="切换疏散算法，查看原理与适用场景">
    <div class="algo-grid">
      <div
        v-for="a in algorithms"
        :key="a.id"
        class="algo-card"
        :class="{ selected: s.algorithm === a.id }"
        @click="select(a.id)"
      >
        <div class="algo-head">
          <span class="algo-name">{{ a.label }}</span>
          <span v-if="a.recommended" class="fp-badge on">推荐</span>
          <span v-else class="fp-badge off">{{ a.scenario }}</span>
        </div>
        <p class="algo-desc">{{ a.description }}</p>
        <p class="algo-scenario">{{ a.scenario }}</p>
      </div>
    </div>

    <div class="fp-card" style="margin-top:14px">
      <h3 class="fp-card-title">口径说明</h3>
      <ul class="note-list">
        <li><b>距离类</b>（距离场 / Dijkstra / A* / BFS）：静态最短路，无个体冲突，「总步数」= 最后一人最短步数。</li>
        <li><b>CA 元胞自动机</b>：逐格步进 + 冲突消解，等待计入路径，呈现排队与绕行。</li>
        <li><b>社交力模型（SFM）</b>：连续坐标仿真，轨迹为浮点坐标，可呈现密度与拥挤现象。</li>
        <li>选好后去「疏散运行」启动计算；需要横向对比请用「对比 · 算法对比」。</li>
      </ul>
    </div>
  </FunctionPage>
</template>

<script setup>
// 仿真 · 算法选择：六种算法（距离场/Dijkstra/A*/BFS/CA/SFM）
import { onMounted } from 'vue'
import FunctionPage from '@/components/FunctionPage.vue'
import { useWorkspace } from '@/composables/useWorkspace'

const ws = useWorkspace()
const s = ws.state
const algorithms = ws.algorithms

function select(id) {
  s.algorithm = id
  ws.showNotice(`已选择算法：${algorithms.value.find((a) => a.id === id)?.label || id}`)
}

onMounted(() => ws.initBackend())
</script>

<style scoped>
.algo-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}
.algo-card {
  background: #fff;
  border: 1px solid #e6e9ef;
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s;
}
.algo-card:hover {
  border-color: #378add;
  box-shadow: 0 4px 14px rgba(13, 128, 224, 0.1);
}
.algo-card.selected {
  border-color: #185fa5;
  background: #f4f9ff;
  box-shadow: 0 0 0 2px rgba(24, 95, 165, 0.18);
}
.algo-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
.algo-name {
  font-size: 14px;
  font-weight: 600;
  color: #1d2129;
}
.algo-desc {
  font-size: 12px;
  color: #4e5969;
  line-height: 1.7;
  margin: 0 0 8px;
}
.algo-scenario {
  font-size: 12px;
  color: #8a9099;
  margin: 0;
}
.note-list {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  color: #4e5969;
  line-height: 2;
}
</style>
