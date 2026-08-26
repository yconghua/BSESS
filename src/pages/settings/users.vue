<template>
  <div class="page">
    <div class="page-header">
      <h2 class="page-title">用户管理</h2>
      <button class="btn primary" :disabled="!isAdmin" @click="openAdd">新增用户</button>
    </div>

    <!-- 非管理员提示 -->
    <section v-if="!isAdmin" class="card">
      <p class="hint">仅管理员可查看与操作用户。当前账号无权限。</p>
    </section>

    <!-- 用户列表 -->
    <section v-else class="card">
      <table class="user-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>账号</th>
            <th>角色</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in users" :key="u.id">
            <td>{{ u.id }}</td>
            <td>{{ u.username }}</td>
            <td>
              <span class="badge" :class="u.role === ROLE_ADMIN ? 'on' : 'off'">{{ roleLabel(u.role) }}</span>
            </td>
            <td>{{ u.created_at }}</td>
            <td class="ops">
              <button class="link-btn" @click="openEdit(u)">编辑</button>
              <button class="link-btn danger" :disabled="u.id === me?.id" @click="openDelete(u)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="!users.length" class="hint">暂无用户</p>
    </section>

    <!-- 新增用户弹窗 -->
    <div v-if="showAdd" class="modal-mask" @click.self="showAdd = false">
      <div class="modal-box">
        <h3 class="modal-title">新增用户</h3>
        <label class="field">
          <span>账号</span>
          <input v-model="addForm.username" class="input" placeholder="登录账号" />
        </label>
        <label class="field">
          <span>角色</span>
          <select v-model="addForm.role" class="input">
            <option value="user">普通用户</option>
            <option :value="ROLE_ADMIN">管理员</option>
          </select>
        </label>
        <p v-if="addPlain" class="plain-pwd">初始密码：<code>{{ addPlain }}</code>（请复制给该用户）</p>
        <p v-if="addMsg" class="msg" :class="{ err: !addPlain }">{{ addMsg }}</p>
        <div class="modal-actions">
          <button class="btn" @click="showAdd = false">关闭</button>
          <button class="btn primary" :disabled="addLoading" @click="onSubmitAdd">
            {{ addLoading ? '创建中…' : '创建' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 编辑用户弹窗（改角色 + 可选重置密码） -->
    <div v-if="showEdit" class="modal-mask" @click.self="showEdit = false">
      <div class="modal-box">
        <h3 class="modal-title">编辑用户：{{ editForm.username }}</h3>
        <label class="field">
          <span>角色</span>
          <select v-model="editForm.role" class="input">
            <option value="user">普通用户</option>
            <option :value="ROLE_ADMIN">管理员</option>
          </select>
        </label>
        <label class="check">
          <input v-model="editForm.resetPassword" type="checkbox" />
          重置密码（生成新的随机密码）
        </label>
        <p v-if="editPlain" class="plain-pwd">新密码：<code>{{ editPlain }}</code></p>
        <p v-if="editMsg" class="msg" :class="{ err: !editPlain }">{{ editMsg }}</p>
        <div class="modal-actions">
          <button class="btn" @click="showEdit = false">关闭</button>
          <button class="btn primary" :disabled="editLoading" @click="onSubmitEdit">
            {{ editLoading ? '保存中…' : '保存' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 删除确认弹窗 -->
    <div v-if="showDelete" class="modal-mask" @click.self="showDelete = false">
      <div class="modal-box">
        <h3 class="modal-title">删除用户</h3>
        <p class="msg">确定要删除用户「{{ deleteTarget?.username }}」吗？此操作不可恢复。</p>
        <div class="modal-actions">
          <button class="btn" @click="showDelete = false">取消</button>
          <button class="btn danger" :disabled="deleteLoading" @click="onConfirmDelete">
            {{ deleteLoading ? '删除中…' : '确认删除' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * 用户管理页（管理员）：列表 / 新增 / 编辑（角色 + 重置密码）/ 删除。
 * 数据源为用户表（MySQL），经 window.api.auth.* 读写。
 */
import { computed, onMounted, ref } from 'vue'
import { getCurrentUser, listUsers, createUser, updateUser, deleteUser } from '../../api'
import { ROLE_ADMIN } from '../../config/constants'

const me = ref(null)
const users = ref([])
const isAdmin = computed(() => me.value?.role === ROLE_ADMIN)

const roleLabel = (r) => (r === ROLE_ADMIN ? '管理员' : '普通用户')

async function loadUsers() {
  try {
    const res = await listUsers()
    if (res?.success) users.value = res.users || []
  } catch {
    // 忽略读取异常
  }
}

// 新增
const showAdd = ref(false)
const addForm = ref({ username: '', role: 'user' })
const addMsg = ref('')
const addPlain = ref('')
const addLoading = ref(false)
function openAdd() {
  addForm.value = { username: '', role: 'user' }
  addMsg.value = ''
  addPlain.value = ''
  showAdd.value = true
}
async function onSubmitAdd() {
  addMsg.value = ''
  addPlain.value = ''
  if (!addForm.value.username.trim()) {
    addMsg.value = '账号不能为空'
    return
  }
  addLoading.value = true
  try {
    const res = await createUser({ username: addForm.value.username.trim(), role: addForm.value.role })
    if (res?.success) {
      addPlain.value = res.plainPassword || ''
      addMsg.value = '创建成功！初始密码已生成，请复制给该用户。'
      loadUsers()
    } else {
      addMsg.value = res?.message || '创建失败'
    }
  } catch {
    addMsg.value = '创建过程出现异常，请重试'
  } finally {
    addLoading.value = false
  }
}

// 编辑
const showEdit = ref(false)
const editForm = ref({ id: null, username: '', role: 'user', resetPassword: false })
const editMsg = ref('')
const editPlain = ref('')
const editLoading = ref(false)
function openEdit(u) {
  editForm.value = { id: u.id, username: u.username, role: u.role, resetPassword: false }
  editMsg.value = ''
  editPlain.value = ''
  showEdit.value = true
}
async function onSubmitEdit() {
  editMsg.value = ''
  editPlain.value = ''
  editLoading.value = true
  try {
    const res = await updateUser({
      id: editForm.value.id,
      role: editForm.value.role,
      resetPassword: editForm.value.resetPassword
    })
    if (res?.success) {
      if (res.plainPassword) {
        editMsg.value = '保存成功！新密码已生成，请复制给该用户。'
        editPlain.value = res.plainPassword
      } else {
        editMsg.value = '保存成功'
        showEdit.value = false
      }
      loadUsers()
    } else {
      editMsg.value = res?.message || '保存失败'
    }
  } catch {
    editMsg.value = '保存过程出现异常，请重试'
  } finally {
    editLoading.value = false
  }
}

// 删除
const showDelete = ref(false)
const deleteTarget = ref(null)
const deleteLoading = ref(false)
function openDelete(u) {
  deleteTarget.value = u
  showDelete.value = true
}
async function onConfirmDelete() {
  deleteLoading.value = true
  try {
    const res = await deleteUser(deleteTarget.value.id)
    showDelete.value = false
    if (res?.success) {
      loadUsers()
    }
  } catch {
    // 忽略
  } finally {
    deleteLoading.value = false
  }
}

onMounted(async () => {
  me.value = await getCurrentUser()
  if (isAdmin.value) loadUsers()
})
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
.btn.primary {
  background: #185fa5;
  border-color: #185fa5;
  color: #fff;
}
.btn.danger {
  background: #a32d2d;
  border-color: #a32d2d;
  color: #fff;
}
.btn:disabled {
  opacity: 0.5;
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
.user-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.user-table th,
.user-table td {
  text-align: left;
  padding: 9px 12px;
  border-bottom: 1px solid #eceff3;
}
.user-table th {
  color: #6a7078;
  font-weight: 600;
  background: #f7f8fa;
}
.badge {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
}
.badge.on {
  background: #e6f1fb;
  color: #185fa5;
}
.badge.off {
  background: #f1efe8;
  color: #5f5e5a;
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
.link-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
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
  width: 360px;
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
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 14px;
  font-size: 13px;
  color: #4e5969;
}
.input {
  padding: 7px 10px;
  border: 1px solid #d4d9e0;
  border-radius: 8px;
  font-size: 13px;
}
.check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #4e5969;
  margin-bottom: 12px;
}
.plain-pwd {
  font-size: 13px;
  color: #185fa5;
  background: #eef6ff;
  border-radius: 8px;
  padding: 8px 10px;
}
.plain-pwd code {
  font-size: 13px;
  font-weight: 600;
}
.msg {
  font-size: 13px;
  color: #2ecc71;
  margin: 0 0 12px;
}
.msg.err {
  color: #a32d2d;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 4px;
}
</style>
