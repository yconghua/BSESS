<template>
  <div class="page">
    <div class="page-header">
      <h2 class="page-title">数据库连接</h2>
      <button class="btn" @click="openBaseConfig">打开基础配置</button>
    </div>

    <!-- 当前数据库状态卡片 -->
    <section class="card">
      <h3 class="card-title">当前数据库</h3>
      <div class="status-row">
        <span class="status-dot" :class="statusClass"></span>
        <span class="status-text">{{ statusText }}</span>
        <span v-if="dbName" class="db-name">{{ dbName }}</span>
        <span v-if="dbError" class="db-error">{{ dbError }}</span>
      </div>
      <p class="hint">数据库连接管理走本地 MySQL（数据不出本机）。新增 / 切换 / 删除连接均在下方弹窗中完成。</p>
    </section>

    <!-- 数据库管理弹窗（与登录页同一套组件与协调逻辑） -->
    <BaseConfig
      :visible="showBaseConfig"
      :refresh-key="settingsRefreshKey"
      @close="showBaseConfig = false"
      @switch-db="openSwitchDb"
    />
    <DbSwitch
      :visible="showSwitchDb"
      :refresh-key="switchRefreshKey"
      :ext-msg="extMsg"
      :ext-msg-ok="extMsgOk"
      @close="showSwitchDb = false"
      @add-db="showAddDb = true"
      @db-changed="onDbChanged"
      @request-delete="onRequestDelete"
    />
    <DbAdd :visible="showAddDb" @close="showAddDb = false" @added="onDbAdded" />
    <DbDeleteConfirm
      :visible="showDeleteConfirm"
      :target-id="pendingDeleteId"
      @close="showDeleteConfirm = false"
      @confirmed="onDeleteConfirmed"
    />
  </div>
</template>

<script setup>
/**
 * 数据库连接页：当前连接状态一览 + 基础配置（切换 / 新增 / 删除）。
 * 复用 components/db/ 弹窗组件与登录页相同的协调逻辑，纯 MySQL 本地管理。
 */
import { computed, onMounted, ref } from 'vue'
import { getDbInfo, deleteDb } from '../../api'
import { BaseConfig, DbSwitch, DbAdd, DbDeleteConfirm } from '../../components/db'

const dbStatus = ref('unknown') // none | connected | disconnected | unknown
const dbName = ref('')
const dbError = ref('')

const statusText = computed(() => {
  switch (dbStatus.value) {
    case 'connected':
      return '已连接'
    case 'none':
      return '未配置数据库'
    case 'disconnected':
      return '连接失败'
    default:
      return '状态未知'
  }
})
const statusClass = computed(() => {
  if (dbStatus.value === 'connected') return 'ok'
  if (dbStatus.value === 'disconnected') return 'err'
  return 'off'
})

async function refreshDbStatus() {
  try {
    const res = await getDbInfo()
    if (res && res.success) {
      dbStatus.value = res.status || 'unknown'
      dbName.value = res.database || ''
      dbError.value = res.error || ''
    } else {
      dbStatus.value = 'unknown'
    }
  } catch {
    dbStatus.value = 'unknown'
  }
}

// ---------------- 数据库弹窗协调（与 LoginView 同构） ----------------
const showBaseConfig = ref(false)
const showSwitchDb = ref(false)
const showAddDb = ref(false)
const showDeleteConfirm = ref(false)
const pendingDeleteId = ref('')
const settingsRefreshKey = ref(0)
const switchRefreshKey = ref(0)
const extMsg = ref('')
const extMsgOk = ref(false)

function openBaseConfig() {
  showBaseConfig.value = true
}

function openSwitchDb() {
  extMsg.value = ''
  extMsgOk.value = false
  showSwitchDb.value = true
}

function onDbChanged() {
  settingsRefreshKey.value++
  refreshDbStatus()
}

function onDbAdded() {
  switchRefreshKey.value++
  refreshDbStatus()
}

function onRequestDelete(id) {
  pendingDeleteId.value = id
  showDeleteConfirm.value = true
}

async function onDeleteConfirmed(id) {
  showDeleteConfirm.value = false
  pendingDeleteId.value = ''
  try {
    const res = await deleteDb(id)
    if (res && res.success) {
      extMsgOk.value = true
      extMsg.value = res.message || '删除成功'
    } else {
      extMsgOk.value = false
      extMsg.value = (res && res.message) || '删除失败'
    }
  } catch {
    extMsgOk.value = false
    extMsg.value = '删除过程出现异常，请重试'
  }
  switchRefreshKey.value++
  refreshDbStatus()
}

onMounted(refreshDbStatus)
</script>

<style scoped>
.page {
  min-height: 100%;
}
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.page-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
}
.btn {
  padding: 7px 16px;
  border: 1px solid #d4d9e0;
  border-radius: 8px;
  background: #fff;
  font-size: 13px;
  cursor: pointer;
}
.btn:hover {
  border-color: #378add;
  color: #185fa5;
}
.card {
  background: #fff;
  border-radius: 10px;
  padding: 20px 24px;
}
.card-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 14px;
}
.status-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
}
.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.status-dot.ok {
  background: #2ecc71;
}
.status-dot.err {
  background: #e74c3c;
}
.status-dot.off {
  background: #b9c0cc;
}
.status-text {
  color: #1f2329;
  font-weight: 600;
}
.db-name {
  color: #4e5969;
  font-family: Consolas, Menlo, monospace;
}
.db-error {
  color: #a32d2d;
  font-size: 13px;
}
.hint {
  margin: 14px 0 0;
  font-size: 12px;
  color: #8a9099;
}
</style>
