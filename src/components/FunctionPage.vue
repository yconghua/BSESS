<template>
  <div class="fp-page" :class="{ tall }">
    <!-- 页头：标题 + 副标题 + 右侧操作区 -->
    <div class="fp-header">
      <h2 class="fp-title">{{ title }}</h2>
      <span class="fp-sub">{{ sub }}</span>
      <div class="fp-actions"><slot name="actions" /></div>
    </div>

    <!-- 主体：可选左侧面板 + 主内容 -->
    <div class="fp-body">
      <aside v-if="$slots.side" class="fp-side"><slot name="side" /></aside>
      <div class="fp-main"><slot /></div>
    </div>

    <slot name="extra" />

    <!-- 全局工作台轻提示 -->
    <transition name="fade">
      <div v-if="notice" class="fp-notice" :class="{ err: noticeErr }">{{ notice }}</div>
    </transition>
  </div>
</template>

<script setup>
/**
 * FunctionPage —— 功能页面通用外壳。
 * 统一页头/双栏布局/全局提示条；16 个功能页面复用，保持观感一致。
 * 传参：title 标题、sub 副标题、tall 是否撑满高度（画布页用）；
 * 插槽：actions 页头按钮、side 左侧面板、默认主内容、extra 额外内容。
 */
import { useWorkspace } from '@/composables/useWorkspace'

defineProps({
  title: { type: String, required: true },
  sub: { type: String, default: '' },
  tall: { type: Boolean, default: false }
})

const { notice, noticeErr } = useWorkspace()
</script>

<style>
/* 全局共享的功能页样式（fp- 前缀，避免污染） */
.fp-page {
  min-height: 100%;
  display: flex;
  flex-direction: column;
}
.fp-page.tall {
  height: 100%;
}
.fp-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}
.fp-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
  white-space: nowrap;
}
.fp-sub {
  font-size: 12px;
  color: #8a9099;
  flex: 1;
  min-width: 0;
}
.fp-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
.fp-body {
  flex: 1;
  display: flex;
  gap: 14px;
  min-height: 0;
}
.fp-side {
  width: 270px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
}
.fp-main {
  flex: 1;
  min-width: 0;
  position: relative;
}
.fp-card {
  background: #fff;
  border: 1px solid #e6e9ef;
  border-radius: 10px;
  padding: 14px 16px;
}
.fp-card-title {
  font-size: 13px;
  font-weight: 600;
  color: #3a3f47;
  margin: 0 0 10px;
}
.fp-btn {
  padding: 6px 14px;
  border: 1px solid #d4d9e0;
  border-radius: 8px;
  background: #fff;
  font-size: 13px;
  cursor: pointer;
}
.fp-btn:hover {
  border-color: #378add;
  color: #185fa5;
}
.fp-btn.primary {
  background: #185fa5;
  border-color: #185fa5;
  color: #fff;
}
.fp-btn.primary:hover {
  background: #0c447c;
  color: #fff;
}
.fp-btn.danger {
  background: #a32d2d;
  border-color: #a32d2d;
  color: #fff;
}
.fp-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.fp-btn.active {
  border-color: #185fa5;
  background: #e6f1fb;
  color: #185fa5;
}
.fp-input {
  padding: 6px 8px;
  border: 1px solid #d4d9e0;
  border-radius: 8px;
  font-size: 13px;
  width: 100%;
}
.fp-select {
  padding: 6px 8px;
  border: 1px solid #d4d9e0;
  border-radius: 8px;
  font-size: 13px;
  width: 100%;
  background: #fff;
}
.fp-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.fp-label {
  font-size: 12px;
  color: #6a7078;
  white-space: nowrap;
}
.fp-hint {
  font-size: 12px;
  color: #8a9099;
  margin: 8px 0 0;
  line-height: 1.6;
}
.fp-hint.err {
  color: #a32d2d;
}
.fp-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.fp-table th,
.fp-table td {
  text-align: left;
  padding: 8px 10px;
  border-bottom: 1px solid #eceff3;
}
.fp-table th {
  color: #6a7078;
  font-weight: 600;
  background: #f7f8fa;
}
.fp-badge {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
}
.fp-badge.on {
  background: #e6f1fb;
  color: #185fa5;
}
.fp-badge.off {
  background: #f1efe8;
  color: #5f5e5a;
}
.fp-notice {
  position: fixed;
  top: 66px;
  left: 50%;
  transform: translateX(-50%);
  background: #eaf3de;
  color: #3b6d11;
  border: 1px solid #c0dd97;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 13px;
  z-index: 300;
}
.fp-notice.err {
  background: #fcebeb;
  color: #a32d2d;
  border-color: #f7c1c1;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
