<template>
  <div class="page">
    <div class="page-header">
      <h2 class="page-title">场景管理</h2>
      <span class="page-sub">我的场景（MySQL scenario 表，按用户隔离）</span>
      <button class="btn" :disabled="loading" @click="loadScenarios">刷新</button>
    </div>

    <div v-if="!hasApi" class="card">
      <p class="hint">场景管理依赖 MySQL，请在 Electron 桌面应用中使用（浏览器模式不可用）。</p>
    </div>

    <section v-else class="card">
      <table class="scene-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>名称</th>
            <th>描述</th>
            <th>尺寸</th>
            <th>出口/人员</th>
            <th>更新时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in scenarios" :key="s.id">
            <td>{{ s.id }}</td>
            <td class="strong">{{ s.name }}</td>
            <td class="desc">{{ s.description || '—' }}</td>
            <td>{{ s.gridData.rows }}×{{ s.gridData.cols }}</td>
            <td>{{ s.exits.length }} / {{ s.agents.length }}</td>
            <td>{{ formatTime(s.updatedAt) }}</td>
            <td class="ops">
              <button class="link-btn" @click="loadScene(s.id)">加载</button>
              <button class="link-btn danger" @click="openDelete(s)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="!scenarios.length && !loading" class="hint">
        暂无场景。去「疏散仿真」页布置好空间后点「保存场景」。
      </p>
    </section>

    <!-- 删除确认 -->
    <div v-if="showDelete" class="modal-mask" @click.self="showDelete = false">
      <div class="modal-box">
        <h3 class="modal-title">删除场景</h3>
        <p class="msg">确定要删除场景「{{ deleteTarget?.name }}」吗？此操作不可恢复。</p>
        <div class="modal-actions">
          <button class="btn" @click="showDelete = false">取消</button>
          <button class="btn danger" :disabled="deleting" @click="onConfirmDelete">
            {{ deleting ? '删除中…' : '确认删除' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * 场景管理页（M2）：当前用户的场景列表 / 加载到编辑器 / 删除。
 * 数据源：MySQL scenario 表，经 window.api.scenario.* 读写。
 */
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { setPendingScene } from '@/composables/useSceneStore'

const router = useRouter()
const hasApi = !!window.api?.scenario
const scenarios = ref([])
const loading = ref(false)
const errMsg = ref('')

async function loadScenarios() {
  if (!hasApi) return
  loading.value = true
  errMsg.value = ''
  try {
    const res = await window.api.scenario.list()
    if (res?.success) scenarios.value = res.scenarios || []
    else errMsg.value = res?.message || '读取失败'
  } catch {
    errMsg.value = '读取过程出现异常'
  } finally {
    loading.value = false
  }
}

/** 加载：取详情 → 写入跨页 store → 跳转疏散页应用 */
async function loadScene(id) {
  try {
    const res = await window.api.scenario.get({ id })
    if (!res?.success) {
      errMsg.value = res?.message || '加载失败'
      return
    }
    setPendingScene(res.scenario)
    router.push('/evacuation-1')
  } catch {
    errMsg.value = '加载过程出现异常'
  }
}

const showDelete = ref(false)
const deleteTarget = ref(null)
const deleting = ref(false)
function openDelete(s) {
  deleteTarget.value = s
  showDelete.value = true
}
async function onConfirmDelete() {
  deleting.value = true
  try {
    const res = await window.api.scenario.remove({ id: deleteTarget.value.id })
    showDelete.value = false
    if (res?.success) loadScenarios()
    else errMsg.value = res?.message || '删除失败'
  } catch {
    errMsg.value = '删除过程出现异常'
  } finally {
    deleting.value = false
  }
}

const formatTime = (t) => (t ? String(t).replace('T', ' ').slice(0, 19) : '—')

onMounted(loadScenarios)
</script>

<style scoped>
.page {
  min-height: 100%;
}
.page-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.page-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
}
.page-sub {
  font-size: 12px;
  color: #8a9099;
  flex: 1;
}
.btn {
  padding: 6px 12px;
  border: 1px solid #d4d9e0;
  border-radius: 8px;
  background: #fff;
  font-size: 13px;
  cursor: pointer;
}
.btn.danger {
  background: #a32d2d;
  border-color: #a32d2d;
  color: #fff;
}
.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.card {
  background: #fff;
  border-radius: 10px;
  padding: 20px 24px;
}
.hint {
  margin: 0;
  font-size: 13px;
  color: #8a9099;
}
.scene-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.scene-table th,
.scene-table td {
  text-align: left;
  padding: 9px 12px;
  border-bottom: 1px solid #eceff3;
}
.scene-table th {
  color: #6a7078;
  font-weight: 600;
  background: #f7f8fa;
}
.strong {
  font-weight: 600;
}
.desc {
  color: #6a7078;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ops {
  display: flex;
  gap: 10px;
}
.link-btn {
  border: none;
  background: none;
  color: #185fa5;
  font-size: 13px;
  cursor: pointer;
  padding: 0;
}
.link-btn.danger {
  color: #a32d2d;
}
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.modal-box {
  width: 380px;
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
}
.modal-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 16px;
}
.msg {
  font-size: 13px;
  color: #4e5969;
  margin: 0 0 16px;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
