<template>
  <div class="page">
    <div class="page-header">
      <h2 class="page-title">仿真记录</h2>
      <span class="page-sub">历史疏散记录（MySQL simulation_record 表）</span>
      <button class="btn" :disabled="loading" @click="loadRecords">刷新</button>
    </div>

    <div v-if="!hasApi" class="card">
      <p class="hint">仿真记录依赖 MySQL，请在 Electron 桌面应用中使用（浏览器模式不可用）。</p>
    </div>

    <section v-else class="card">
      <table class="rec-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>算法</th>
            <th>总步数</th>
            <th>平均</th>
            <th>最长</th>
            <th>不可达</th>
            <th>耗时(ms)</th>
            <th>仿真时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in records" :key="r.id">
            <td>{{ r.id }}</td>
            <td>{{ algLabel(r.algorithm) }}</td>
            <td>{{ r.stats.totalSteps }}</td>
            <td>{{ r.stats.avgPathLength }}</td>
            <td>{{ r.stats.maxPathLength }}</td>
            <td :class="{ warn: r.stats.unreachableCount > 0 }">{{ r.stats.unreachableCount }}</td>
            <td>{{ r.computationTimeMs }}</td>
            <td>{{ formatTime(r.createdAt) }}</td>
            <td class="ops">
              <button class="link-btn" @click="openDetail(r.id)">详情</button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="!records.length && !loading" class="hint">
        暂无记录。去「疏散仿真」页点「开始疏散」，结果会自动落库。
      </p>
    </section>

    <!-- 详情弹窗 -->
    <div v-if="showDetail" class="modal-mask" @click.self="showDetail = false">
      <div class="modal-box wide">
        <h3 class="modal-title">仿真详情 #{{ detail?.id }}（{{ algLabel(detail?.algorithm) }}）</h3>
        <ul v-if="detail" class="stat-list">
          <li>总步数（makespan）<span>{{ detail.stats.totalSteps }}</span></li>
          <li>平均路径 <span>{{ detail.stats.avgPathLength }}</span></li>
          <li>最长路径 <span>{{ detail.stats.maxPathLength }}</span></li>
          <li>不可达人数 <span :class="{ warn: detail.stats.unreachableCount > 0 }">{{ detail.stats.unreachableCount }}</span></li>
          <li>计算耗时 <span>{{ detail.computationTimeMs }} ms</span></li>
          <li>仿真时间 <span>{{ formatTime(detail.createdAt) }}</span></li>
        </ul>
        <div v-if="detail?.stats?.exitDistribution?.length" class="exit-dist">
          <span v-for="e in detail.stats.exitDistribution" :key="`${e.row}-${e.col}`" class="exit-chip">
            出口({{ e.row }},{{ e.col }})：{{ e.count }}人
          </span>
        </div>
        <p class="hint">路径数据共 {{ detail?.pathCount ?? 0 }} 条（不可达为空数组），可导出 JSON 分析。</p>
        <div class="modal-actions">
          <button class="btn" @click="showDetail = false">关闭</button>
          <button class="btn" @click="exportDetailJson">导出 JSON</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * 仿真记录页（M2）：历史记录列表 + 详情（含完整路径导出）。
 * 数据源：MySQL simulation_record 表，经 window.api.simRecord.* 读写。
 */
import { onMounted, ref } from 'vue'

const hasApi = !!window.api?.simRecord
const records = ref([])
const loading = ref(false)
const errMsg = ref('')

const ALG_LABELS = {
  distanceField: '多源距离场',
  dijkstra: 'Dijkstra',
  astar: 'A*',
  bfs: 'BFS',
  ca: 'CA 元胞自动机'
}
const algLabel = (id) => ALG_LABELS[id] || id

async function loadRecords() {
  if (!hasApi) return
  loading.value = true
  errMsg.value = ''
  try {
    const res = await window.api.simRecord.list()
    if (res?.success) records.value = res.records || []
    else errMsg.value = res?.message || '读取失败'
  } catch {
    errMsg.value = '读取过程出现异常'
  } finally {
    loading.value = false
  }
}

// 详情
const showDetail = ref(false)
const detail = ref(null)
async function openDetail(id) {
  try {
    const res = await window.api.simRecord.get({ id })
    if (res?.success) {
      detail.value = res.record
      showDetail.value = true
    } else {
      errMsg.value = res?.message || '读取详情失败'
    }
  } catch {
    errMsg.value = '读取详情过程出现异常'
  }
}

function exportDetailJson() {
  const payload = JSON.stringify(detail.value, null, 2)
  const blob = new Blob([payload], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `bsess_record_${detail.value.id}.json`
  a.click()
  URL.revokeObjectURL(url)
}

const formatTime = (t) => (t ? String(t).replace('T', ' ').slice(0, 19) : '—')

onMounted(loadRecords)
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
.rec-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.rec-table th,
.rec-table td {
  text-align: left;
  padding: 9px 12px;
  border-bottom: 1px solid #eceff3;
}
.rec-table th {
  color: #6a7078;
  font-weight: 600;
  background: #f7f8fa;
}
.warn {
  color: #a32d2d;
  font-weight: 600;
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
  width: 420px;
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
}
.modal-box.wide {
  width: 520px;
}
.modal-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 16px;
}
.stat-list {
  list-style: none;
  margin: 0 0 12px;
  padding: 0;
  font-size: 13px;
}
.stat-list li {
  display: flex;
  justify-content: space-between;
  padding: 5px 0;
  border-bottom: 1px dashed #eceff3;
}
.stat-list span {
  font-weight: 600;
}
.warn {
  color: #a32d2d;
}
.exit-dist {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.exit-chip {
  font-size: 12px;
  background: #eef6ff;
  color: #185fa5;
  border-radius: 6px;
  padding: 3px 8px;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
