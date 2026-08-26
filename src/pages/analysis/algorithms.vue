<template>
  <div class="page">
    <div class="page-header">
      <h2 class="page-title">算法说明</h2>
      <span class="page-sub">五种疏散路径算法的原理与适用场景（全部基于 4 邻接等权网格）</span>
    </div>

    <div class="grid2">
      <section v-for="a in ALGORITHMS" :key="a.id" class="card">
        <h3 class="card-title">
          {{ a.label }}
          <span v-if="a.recommended" class="tag">推荐</span>
        </h3>
        <p class="desc">{{ a.desc }}</p>
        <ul class="meta">
          <li><span>适用</span>{{ a.scenario }}</li>
          <li><span>复杂度</span>{{ a.complexity }}</li>
          <li><span>特点</span>{{ a.note }}</li>
        </ul>
      </section>
    </div>

    <section class="card tip-card">
      <p class="tip-title">口径说明</p>
      <ul class="meta">
        <li><span>距离类算法</span>（距离场 / Dijkstra / A* / BFS）路径为静态最短路，无个体间冲突；「总步数」= 最后一人最短步数。</li>
        <li><span>CA 元胞自动机</span>逐格步进，同格冲突消解；等待会计入路径，「总步数 / 平均路径」为含排队的真实疏散时长，动画可见排队与绕行。</li>
        <li><span>社交力模型（SFM）</span>连续坐标仿真，轨迹为浮点坐标；「总步数」为轨迹点间隔（每点 ≈ 0.2s），可直接换算真实疏散时间。</li>
        <li>四种距离类算法在 4 邻接等权网格上最优代价一致，差异仅在计算方式与耗时——可用「批量实验」页对比。</li>
      </ul>
    </section>
  </div>
</template>

<script setup>
/**
 * 算法说明页（静态内容）：五种算法的原理 / 适用场景 / 复杂度。
 */
const ALGORITHMS = [
  {
    id: 'distanceField',
    label: '多源距离场',
    recommended: true,
    desc: '从所有出口同时做一次反向 BFS，得到全场「到最近出口的步数」距离场；每个人员沿梯度下降走，自动分流到最近出口。',
    scenario: '多出口 / 大网格（默认推荐）',
    complexity: 'O(rows×cols)，一次计算服务全体',
    note: '效率最高；距离场还可叠加成热力图直观展示远近'
  },
  {
    id: 'dijkstra',
    label: 'Dijkstra',
    recommended: false,
    desc: '用优先队列按代价出队的多源最短路，可扩展到非等权图（如通道宽度、密度代价）。等权网格下结果与距离场完全一致。',
    scenario: '有权图 / 教学对照',
    complexity: 'O(E log V)',
    note: '保留作算法对照，验证等权网格等价性'
  },
  {
    id: 'astar',
    label: 'A*',
    recommended: false,
    desc: '多目标 A*：启发式取「到任一出口的曼哈顿距离」的最小值（可采纳，保证最优）。只搜索必要区域，大网格上更快。',
    scenario: '单出口 / 大体量快速搜索',
    complexity: '搜索范围与启发式质量相关，通常最小',
    note: '多出口自动选最近出口；动画与最短路一致'
  },
  {
    id: 'bfs',
    label: 'BFS',
    recommended: false,
    desc: '从每个人员起点逐层扩展，首次碰到任一出口即回溯路径。无权网格下 BFS 得到的就是最短路径（步数最少）。',
    scenario: '无权图 / 教学演示',
    complexity: 'O(人数 × (rows×cols))',
    note: '固定 4 邻接；与对角 √2 代价语义冲突故不启用 8 邻接'
  },
  {
    id: 'ca',
    label: 'CA 元胞自动机',
    recommended: false,
    desc: '逐格步进仿真：每个未撤离人员按距离场梯度选「距离更小」的邻格，同一格多人竞争时随机公平消解，全被占则原地等待。',
    scenario: '多智能体 / 拥堵演示',
    complexity: 'O(步数 × 人数)，步数与拥堵程度正相关',
    note: '能呈现出口排队与绕行；统计为真实疏散时长，适合做拥堵研究'
  },
  {
    id: 'sfm',
    label: '社交力模型（SFM）',
    recommended: false,
    desc: '连续坐标下的 Helbing 简化版：行人受期望力（朝距离场梯度方向）、障碍排斥力、人际排斥力与随机扰动共同作用，速度连续变化。',
    scenario: '连续空间 / 密度研究',
    complexity: 'O(步数 × (人数² + 局部障碍数))，步长 0.1s',
    note: '可呈现拱形堵塞、人群密度效应等精细现象，学术价值最高的模型'
  }
]
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
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 10px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.tag {
  font-size: 11px;
  background: #e6f1fb;
  color: #185fa5;
  border-radius: 10px;
  padding: 1px 8px;
  font-weight: 400;
}
.desc {
  font-size: 13px;
  color: #4e5969;
  line-height: 1.7;
  margin: 0 0 12px;
}
.meta {
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 12px;
  color: #6a7078;
  line-height: 1.8;
}
.meta span {
  display: inline-block;
  width: 56px;
  color: #3a3f47;
  font-weight: 600;
}
.tip-card {
  margin-top: 14px;
}
.tip-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 8px;
}
</style>
