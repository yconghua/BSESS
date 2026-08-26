<template>
  <GridCanvas ref="gridRef" @cell-click="ws.onCellClick" />
</template>

<script setup>
/**
 * SceneCanvas —— 与全局工作台状态绑定的 3D 场景画布。
 * 任何功能页面直接使用 <SceneCanvas/>，挂载即接管共享场景渲染与点击涂绘。
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import GridCanvas from './GridCanvas.vue'
import { useWorkspace } from '@/composables/useWorkspace'

const ws = useWorkspace()
const gridRef = ref(null)

onMounted(() => ws.mountCanvas(gridRef))
onBeforeUnmount(() => ws.unmountCanvas())
</script>
