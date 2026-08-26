<template>
  <div class="page">
    <h2 class="page-title">场景管理</h2>
    <section class="card">
      <p class="tip">M2 功能开发中。</p>
      <ul class="plan">
        <li>将当前 3D 场景（地形 / 出口 / 人员）保存到 MySQL（scenario 表，关联当前用户）</li>
        <li>场景列表加载复用：登录后选择自己的历史场景一键恢复</li>
        <li>场景导出 / 导入 JSON 文件（跨机器迁移）</li>
      </ul>
    </section>
  </div>
</template>

<script setup>
// 场景管理（M2）：MySQL 场景保存 / 加载复用
</script>

<style scoped>
.page {
  min-height: 100%;
}
.page-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 16px;
}
.card {
  background: #fff;
  border-radius: 10px;
  padding: 40px 28px;
}
.tip {
  margin: 0 0 16px;
  font-size: 14px;
  color: #8a9099;
}
.plan {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  color: #4e5969;
  line-height: 2;
}
</style>
