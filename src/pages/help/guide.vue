<template>
  <div class="page">
    <div class="page-header">
      <h2 class="page-title">使用指南</h2>
      <span class="page-sub">快速上手 · 算法选择建议 · 常见问题</span>
    </div>

    <!-- 快速上手 -->
    <section class="card">
      <h3 class="card-title">快速上手（四步）</h3>
      <ol class="steps">
        <li>
          <b>设定空间</b>：在「疏散仿真」页左侧输入行数与列数（3~300），点击「生成网格」。
        </li>
        <li>
          <b>布置环境</b>：切换绘制模式（障碍物 / 出口 / 人员 / 清除），在 3D 场景中点击格子涂绘；
          也可用「随机生成 N 人」快速铺人。出口至少 1 个。
        </li>
        <li>
          <b>选择算法并仿真</b>：下拉选择算法（多源距离场为默认推荐），点「▶ 开始疏散」——
          Python 后端计算路径，3D 场景播放动画，右侧统计面板展示结果；「热力图」按钮可叠加距离场。
        </li>
        <li>
          <b>保存与复用</b>：点「保存场景」存入 MySQL（可在「场景管理」加载 / 删除）；
          「导出 / 导入 JSON」可把场景带走。每次仿真自动记入「仿真记录」。
        </li>
      </ol>
    </section>

    <!-- 算法选择 -->
    <section class="card">
      <h3 class="card-title">算法怎么选</h3>
      <table class="guide-table">
        <thead>
          <tr>
            <th>场景</th>
            <th>推荐算法</th>
            <th>理由</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>多出口、大网格</td>
            <td>多源距离场</td>
            <td>一次计算服务全体，自动分流到最近出口，速度最快</td>
          </tr>
          <tr>
            <td>单出口、超大规模</td>
            <td>A*</td>
            <td>启发式只搜必要区域，单目标下最省计算</td>
          </tr>
          <tr>
            <td>教学对比 / 算法验证</td>
            <td>Dijkstra / BFS</td>
            <td>与距离场结果等价，可对照验证「四算法最优代价一致」</td>
          </tr>
          <tr>
            <td>研究拥堵 / 排队现象</td>
            <td>CA 元胞自动机</td>
            <td>逐格步进 + 冲突消解，能看到出口排队与绕行，统计为真实疏散时长</td>
          </tr>
        </tbody>
      </table>
      <p class="hint">想对比全部算法？去「数据分析 · 批量实验」，一键跑 5 种算法并导出 CSV / JSON。</p>
    </section>

    <!-- 常见问题 -->
    <section class="card">
      <h3 class="card-title">常见问题</h3>
      <dl class="faq">
        <dt>点「开始疏散」提示连不上后端？</dt>
        <dd>桌面端会自动拉起 Python 计算服务（可在「系统管理 · 系统信息」查看状态）；纯浏览器调试时需手动启动 uvicorn（.venv\\Scripts\\python -m uvicorn app.main:app --port 8000）。</dd>
        <dt>保存场景 / 仿真记录按钮不可用？</dt>
        <dd>这两个功能依赖本地 MySQL，仅在 Electron 桌面应用内可用；浏览器开发模式为只读。</dd>
        <dt>为什么四种距离类算法跑出来的结果一样？</dt>
        <dd>4 邻接等权网格上它们的最短路径代价一致，差异只在计算方式与耗时——这正是批量实验的对比看点。</dd>
        <dt>动画里有人一直站着不动还变红了？</dt>
        <dd>红色代表「不可达」：该人员起点被障碍包围、无法到达任何出口，请调整障碍布局或出口位置。</dd>
      </dl>
    </section>
  </div>
</template>

<script setup>
// 使用指南页（静态内容）
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
.card {
  background: #fff;
  border-radius: 10px;
  padding: 20px 24px;
  margin-bottom: 14px;
}
.card-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 14px;
}
.steps {
  margin: 0;
  padding-left: 20px;
  font-size: 13px;
  color: #4e5969;
  line-height: 2;
}
.steps b {
  color: #185fa5;
}
.guide-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.guide-table th,
.guide-table td {
  text-align: left;
  padding: 9px 12px;
  border-bottom: 1px solid #eceff3;
}
.guide-table th {
  color: #6a7078;
  font-weight: 600;
  background: #f7f8fa;
}
.hint {
  font-size: 12px;
  color: #8a9099;
  margin: 12px 0 0;
}
.faq {
  margin: 0;
}
.faq dt {
  font-size: 13px;
  font-weight: 600;
  color: #1d2129;
  margin: 10px 0 4px;
}
.faq dd {
  font-size: 13px;
  color: #4e5969;
  line-height: 1.7;
  margin: 0 0 4px;
}
</style>
