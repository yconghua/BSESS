<template>
  <div class="hp">
    <!-- 顶部：欢迎语横幅 -->
    <section class="hp-hero">
      <div class="hp-hero-inner">
        <h1 class="hp-greeting">{{ greeting }}</h1>
        <p class="hp-date">{{ todayText }}</p>
      </div>
    </section>

    <!-- 功能模块入口 -->
    <section class="hp-section">
      <h2 class="hp-section-title">功能模块</h2>
      <div class="hp-grid">
        <div
          v-for="card in cards"
          :key="card.to"
          class="hp-card"
          @click="go(card.to)"
        >
          <div class="hp-card-icon" :style="{ background: card.color }">{{ card.icon }}</div>
          <div class="hp-card-body">
            <h3 class="hp-card-title">{{ card.title }}</h3>
            <p class="hp-card-desc">{{ card.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- 系统简介 -->
    <section class="hp-section">
      <h2 class="hp-section-title">系统简介</h2>
      <p class="hp-tip">
        有界空间疏散仿真系统（BSESS）面向任意封闭空间：用户自定义空间尺寸、布置障碍物与出口、选择算法，
        即可获得疏散路径方案与三维可视化动画。六种算法（距离场 / Dijkstra / A* / BFS / CA 元胞自动机 / 社交力模型）
        可在「数据分析 · 批量实验」中一键对比；场景与仿真记录保存在本地 MySQL。
      </p>
    </section>
  </div>
</template>

<script setup>
/**
 * 首页：欢迎横幅 + 功能模块快捷入口（数据驱动，改 cards 即可增删）。
 */
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const go = (to) => router.push(to)

const greeting = ref('')
const todayText = ref('')
const WEEK = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
function buildHero() {
  const d = new Date()
  const h = d.getHours()
  greeting.value = h < 12 ? '早上好' : h < 18 ? '下午好' : '晚上好'
  todayText.value = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${WEEK[d.getDay()]}`
}

// 功能卡片：icon / color 用于色块，to 为路由（对应四大核心导航 + 常用入口）
const cards = [
  { icon: '新', color: '#185fa5', to: '/scene-new', title: '空间新建', desc: '设定网格行列，生成疏散空间' },
  { icon: '障', color: '#555b66', to: '/scene-obstacle', title: '障碍布置', desc: '放置 / 清除障碍物' },
  { icon: '口', color: '#2ecc71', to: '/scene-exit', title: '出口标记', desc: '标注一个或多个疏散出口' },
  { icon: '人', color: '#3498db', to: '/scene-agent', title: '人员设定', desc: '手动放置 / 随机生成人员' },
  { icon: '运', color: '#0f6e56', to: '/sim-run', title: '疏散运行', desc: '启动计算并播放 3D 路径动画' },
  { icon: '算', color: '#ba7517', to: '/cmp-algo', title: '算法对比', desc: '六种算法同场景对比，导出 CSV' },
  { icon: '报', color: '#7f77dd', to: '/anl-report', title: '统计报表', desc: '总步数 / 平均 / 最长 / 不可达' },
  { icon: '热', color: '#d85a30', to: '/anl-heatmap', title: '热力诊断', desc: '距离场热力图 + 瓶颈识别' },
  { icon: '导', color: '#3b6d11', to: '/cmp-report', title: '报告导出', desc: 'HTML 报告（可另存 PDF）/ CSV' }
]

onMounted(() => {
  buildHero()
})
</script>

<style scoped>
.hp {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

/* 顶部横幅 */
.hp-hero {
  position: relative;
  overflow: hidden;
  text-align: center;
  padding: 38px 20px 34px;
  border-radius: 16px;
  background: linear-gradient(135deg, #0d80e0 0%, #19a558 100%);
  box-shadow: 0 10px 28px rgba(13, 128, 224, 0.22);
}
.hp-hero::after {
  content: '';
  position: absolute;
  right: -60px;
  top: -60px;
  width: 200px;
  height: 200px;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 50%;
}
.hp-greeting {
  position: relative;
  margin: 0;
  font-size: 30px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 1px;
}
.hp-date {
  position: relative;
  margin: 10px 0 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
}

/* 区块标题 */
.hp-section-title {
  margin: 0 0 12px;
  font-size: 16px;
  font-weight: 700;
  color: #1d2129;
}
.hp-tip {
  margin: 0;
  font-size: 14px;
  color: #6a7078;
  line-height: 1.8;
}

/* 功能卡片 */
.hp-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}
.hp-card {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #fff;
  border: 1px solid #eceff3;
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s;
}
.hp-card:hover {
  border-color: #0d80e0;
  box-shadow: 0 6px 18px rgba(13, 128, 224, 0.12);
  transform: translateY(-2px);
}
.hp-card-icon {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  color: #fff;
  font-size: 18px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.hp-card-body {
  min-width: 0;
}
.hp-card-title {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 600;
  color: #1d2129;
}
.hp-card-desc {
  margin: 0;
  font-size: 12px;
  color: #8a9099;
  line-height: 1.5;
}
</style>
