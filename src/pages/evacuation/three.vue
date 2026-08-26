<template>
  <div class="page">
    <h2 class="page-title">仿真记录</h2>
    <section class="card">
      <p class="tip">M2 功能开发中。</p>
      <ul class="plan">
        <li>每次「开始疏散」的结果自动写入 MySQL（simulation_record 表）</li>
        <li>按场景 / 算法 / 时间查询历史仿真，回看当时的路径与统计</li>
        <li>算法耗时对比（distanceField / Dijkstra / A* / BFS）批量实验导出</li>
      </ul>
    </section>
  </div>
</template>

<script setup>
// 仿真记录（M2）：simulation_record 历史查询
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
