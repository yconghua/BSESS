<template>
  <div class="page">
    <div class="page-header">
      <h2 class="page-title">疏散仿真（M0 原型）</h2>
      <span class="page-sub">内置示例场景：20×30 网格，两出口，多障碍。控制面板接入后由面板驱动。</span>
    </div>
    <div class="scene-wrap">
      <GridCanvas ref="gridRef" />
    </div>
  </div>
</template>

<script setup>
/**
 * 疏散仿真页（M0 第一步：验证 Three.js 渲染链路）。
 * 先内置一个示例场景让 3D 立即可见；后续由 ControlPanel 接管数据来源。
 */
import { onMounted, ref } from 'vue'
import GridCanvas from '@/components/evacuation/GridCanvas.vue'

const gridRef = ref(null)

// 内置示例：20 行 × 30 列
const ROWS = 20
const COLS = 30

function buildSampleScene() {
  // cells 只存地形：0 空地 / 1 障碍
  const cells = Array.from({ length: ROWS }, () => Array(COLS).fill(0))
  // 中间一道横墙（第 10 行），中间留 4 格缺口，把空间分成上下两区
  for (let c = 0; c < COLS; c++) {
    if (c < 12 || c > 17) cells[10][c] = 1
  }
  // 上下区各加几块独立障碍，制造绕行
  for (const [r, c] of [[3, 8], [4, 8], [3, 9], [6, 20], [6, 21], [15, 6], [15, 7], [16, 22], [16, 23]]) {
    cells[r][c] = 1
  }
  // 两个出口：上墙正中、下墙正中（在边界内、空地格上）
  const exits = [
    { row: 0, col: 14 },
    { row: 19, col: 14 }
  ]
  // 10 名人员分散在上下两区
  const agents = [
    { row: 3, col: 3 }, { row: 5, col: 15 }, { row: 7, col: 26 },
    { row: 2, col: 20 }, { row: 4, col: 12 }, { row: 13, col: 4 },
    { row: 15, col: 13 }, { row: 17, col: 24 }, { row: 12, col: 27 },
    { row: 18, col: 8 }
  ]
  return { rows: ROWS, cols: COLS, cells, exits, agents }
}

onMounted(() => {
  gridRef.value?.renderGrid(buildSampleScene())
})
</script>

<style scoped>
.page {
  min-height: 100%;
  display: flex;
  flex-direction: column;
}
.page-header {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 12px;
}
.page-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
}
.page-sub {
  font-size: 12px;
  color: #8a9099;
}
.scene-wrap {
  flex: 1;
  min-height: 480px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid #e6e9ef;
  background: #f5f6f9;
}
</style>
