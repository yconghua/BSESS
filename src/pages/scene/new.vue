<template>
  <FunctionPage title="空间新建" sub="设定网格行数与列数，生成疏散空间" tall>
    <template #actions>
      <button class="fp-btn" :disabled="saving" @click="saveScene">{{ saving ? '保存中…' : '保存到场景库' }}</button>
    </template>
    <template #side>
      <div class="fp-card">
        <h3 class="fp-card-title">网格尺寸</h3>
        <div class="fp-row">
          <span class="fp-label" style="width:34px">行数</span>
          <input v-model.number="rowsInput" class="fp-input" type="number" min="3" max="300" />
        </div>
        <div class="fp-row">
          <span class="fp-label" style="width:34px">列数</span>
          <input v-model.number="colsInput" class="fp-input" type="number" min="3" max="300" />
        </div>
        <button class="fp-btn primary" style="width:100%" @click="onGenerate">生成网格</button>
        <p class="fp-hint">生成后空间为全空地，请继续到「障碍布置 / 出口标记 / 人员设定」搭建环境。</p>
      </div>
      <div class="fp-card">
        <h3 class="fp-card-title">当前空间</h3>
        <p class="fp-hint">
          {{ s.rows }}×{{ s.cols }} 网格 · 障碍 {{ obstacleCount }} 格 · 出口 {{ s.exits.length }} · 人员 {{ s.agents.length }}
        </p>
      </div>
    </template>
    <div class="canvas-wrap"><SceneCanvas /></div>
  </FunctionPage>
</template>

<script setup>
// 场景 · 空间新建：设定网格行列并生成
import { computed, ref } from 'vue'
import FunctionPage from '@/components/FunctionPage.vue'
import SceneCanvas from '@/components/evacuation/SceneCanvas.vue'
import { useWorkspace } from '@/composables/useWorkspace'

const ws = useWorkspace()
const s = ws.state
const rowsInput = ref(s.rows)
const colsInput = ref(s.cols)
const saving = ref(false)

function onGenerate() {
  const r = Math.min(300, Math.max(3, rowsInput.value || 20))
  const c = Math.min(300, Math.max(3, colsInput.value || 30))
  ws.generate(r, c)
  ws.showNotice(`已生成 ${r}×${c} 疏散空间`)
}

/** 保存当前场景到 MySQL（Electron 环境），供「对比 · 场景对比」读取 */
async function saveScene() {
  if (!window.api?.scenario?.save) {
    ws.showNotice('保存到场景库依赖 MySQL，请在 Electron 桌面应用中使用', true)
    return
  }
  saving.value = true
  try {
    const res = await window.api.scenario.save({
      name: `${s.rows}×${s.cols} 场景 ${new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`,
      description: `障碍 ${obstacleCount.value} 格 · 出口 ${s.exits.length} · 人员 ${s.agents.length}`,
      gridData: { rows: s.rows, cols: s.cols, cells: s.cells },
      exits: s.exits,
      agents: s.agents,
      settings: { algorithm: s.algorithm }
    })
    if (res?.success) ws.showNotice(`场景已保存（#${res.id}）`)
    else ws.showNotice(res?.message || '保存失败', true)
  } catch {
    ws.showNotice('保存过程出现异常', true)
  } finally {
    saving.value = false
  }
}

const obstacleCount = computed(() => s.cells.flat().filter((v) => v === 1).length)
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
