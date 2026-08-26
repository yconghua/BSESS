<template>
  <div class="page">
    <div class="page-header">
      <h2 class="page-title">系统信息</h2>
      <span class="page-sub">程序与后端计算服务的运行状态</span>
    </div>

    <div class="grid2">
      <!-- 程序信息 -->
      <section class="card">
        <h3 class="card-title">程序信息</h3>
        <ul class="info">
          <li><span>系统名称</span>{{ sysName || '—' }}</li>
          <li><span>版本号</span>{{ sysVersion || '—' }}</li>
        </ul>
      </section>

      <!-- 后端计算服务 -->
      <section class="card">
        <h3 class="card-title">后端计算服务（FastAPI）</h3>
        <ul class="info">
          <li>
            <span>状态</span>
            <span class="badge" :class="backendStatusClass">{{ backendStatusText }}</span>
          </li>
          <li><span>地址</span>{{ backendUrl || '—' }}</li>
          <li><span>端口</span>{{ backendPort ?? '—' }}</li>
          <li>
            <span>来源</span>{{ backendAdopted ? '复用外部实例' : '由桌面壳拉起' }}
          </li>
        </ul>
        <div class="actions">
          <button class="btn" :disabled="backendBusy" @click="refreshBackend">刷新状态</button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
/**
 * 系统信息页：程序名称/版本（sys:info）+ 后端计算服务状态（backend:status）。
 */
import { computed, onMounted, ref } from 'vue'

const hasApi = !!window.api
const sysName = ref('')
const sysVersion = ref('')
const backendStatus = ref('unknown')
const backendUrl = ref('')
const backendPort = ref(null)
const backendAdopted = ref(false)
const backendBusy = ref(false)

const backendStatusText = computed(() => {
  switch (backendStatus.value) {
    case 'running':
      return '运行中'
    case 'starting':
      return '启动中'
    case 'stopped':
      return '已停止'
    case 'error':
      return '异常'
    default:
      return '未知'
  }
})
const backendStatusClass = computed(() => {
  if (backendStatus.value === 'running') return 'ok'
  if (backendStatus.value === 'error') return 'err'
  return 'off'
})

async function loadSysInfo() {
  if (!hasApi) return
  try {
    const res = await window.api.sys.info()
    if (res?.success) {
      sysName.value = res.name || ''
      sysVersion.value = res.version || ''
    }
  } catch {
    // 忽略
  }
}

async function refreshBackend() {
  if (!hasApi) return
  backendBusy.value = true
  try {
    const res = await window.api.backend.status()
    if (res?.success) {
      backendStatus.value = res.status || 'unknown'
      backendUrl.value = res.url || ''
      backendPort.value = res.port ?? null
      backendAdopted.value = !!res.adopted
    }
  } catch {
    backendStatus.value = 'unknown'
  } finally {
    backendBusy.value = false
  }
}

onMounted(() => {
  loadSysInfo()
  refreshBackend()
})
</script>

<style scoped>
.page {
  min-height: 100%;
}
.page-header {
  display: flex;
  align-items: baseline;
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
}
.grid2 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
}
.card {
  background: #fff;
  border-radius: 10px;
  padding: 18px 20px;
}
.card-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 12px;
}
.info {
  list-style: none;
  margin: 0 0 12px;
  padding: 0;
  font-size: 13px;
}
.info li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
  border-bottom: 1px dashed #eceff3;
}
.info li:last-child {
  border-bottom: none;
}
.info span:first-child {
  width: 70px;
  color: #6a7078;
  flex-shrink: 0;
}
.badge {
  font-size: 12px;
  border-radius: 10px;
  padding: 1px 10px;
}
.badge.ok {
  background: #eaf3de;
  color: #3b6d11;
}
.badge.err {
  background: #fcebeb;
  color: #a32d2d;
}
.badge.off {
  background: #f1efe8;
  color: #5f5e5a;
}
.actions {
  display: flex;
  justify-content: flex-end;
}
.btn {
  padding: 6px 14px;
  border: 1px solid #d4d9e0;
  border-radius: 8px;
  background: #fff;
  font-size: 13px;
  cursor: pointer;
}
.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
