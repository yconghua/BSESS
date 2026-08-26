<template>
  <div ref="containerRef" class="grid-canvas"></div>
</template>

<script setup>
/**
 * GridCanvas —— Three.js 3D 场景组件（M0：网格/障碍/出口/人员渲染 + 相机控制）。
 *
 * 设计约定（与后端一致）：
 *   - 逻辑层是二维网格 grid[row][col]（row 向下、col 向右），三维只是表现层；
 *   - 世界坐标映射：x = col - (cols-1)/2，z = row - (rows-1)/2（网格居中于原点）；
 *   - 对外只暴露 renderGrid() / setAgentPositions()，父组件（控制面板）负责数据。
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

// 各图层配色（浅色主题下使用）
const COLOR_GROUND = 0xe9edf3   // 空地格（浅灰蓝）
const COLOR_GROUND_DARK = 0xb9c0cc // 障碍格底座
const COLOR_OBSTACLE = 0x555b66 // 障碍物（深灰）
const COLOR_EXIT = 0x2ecc71     // 出口（绿，发光）
const COLOR_AGENT = 0x3498db    // 人员（蓝）

const containerRef = ref(null)

let renderer = null
let scene = null
let camera = null
let controls = null
let animationId = 0
let resizeObserver = null

// 各图层实例网格（重建时先 dispose 旧的）
let tileMesh = null
let obstacleMesh = null
let exitMesh = null
let agentMesh = null

let currentRows = 0
let currentCols = 0

/** grid (row, col) → three 世界坐标 (x, z)，网格整体居中于原点 */
function gridToWorld(row, col) {
  return {
    x: col - (currentCols - 1) / 2,
    z: row - (currentRows - 1) / 2
  }
}

/** 初始化 Three.js 场景：渲染器 / 相机 / 灯光 / 轨道控制 / 动画循环 */
function initScene() {
  const el = containerRef.value
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(el.clientWidth, el.clientHeight)
  el.appendChild(renderer.domElement)

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xf5f6f9)

  camera = new THREE.PerspectiveCamera(50, el.clientWidth / el.clientHeight, 0.1, 2000)

  // 环境光 + 平行光：保证地面、方块、球体都有明暗层次
  scene.add(new THREE.AmbientLight(0xffffff, 0.75))
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.1)
  dirLight.position.set(30, 60, 20)
  scene.add(dirLight)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true // 惯性旋转手感
  controls.maxPolarAngle = Math.PI / 2.15 // 不允许钻到地面以下

  // 动画循环：持续渲染（后续路径动画也挂在这里）
  const animate = () => {
    animationId = requestAnimationFrame(animate)
    controls.update()
    renderer.render(scene, camera)
  }
  animate()

  // 容器尺寸变化时同步渲染器与相机
  resizeObserver = new ResizeObserver(() => {
    const w = el.clientWidth
    const h = el.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  })
  resizeObserver.observe(el)
}

/** 销毁场景：释放 GPU 资源与事件监听（组件卸载时调用） */
function disposeScene() {
  cancelAnimationFrame(animationId)
  resizeObserver?.disconnect()
  controls?.dispose()
  for (const mesh of [tileMesh, obstacleMesh, exitMesh, agentMesh]) {
    if (mesh) {
      scene?.remove(mesh)
      mesh.geometry.dispose()
      mesh.material.dispose()
    }
  }
  if (renderer) {
    renderer.dispose()
    renderer.domElement.remove()
    renderer = null
  }
}

/** 工具：创建 InstancedMesh 并逐实例设置位置/颜色 */
function makeInstanced(geometry, material, items, colorOf) {
  const mesh = new THREE.InstancedMesh(geometry, material, items.length)
  const dummy = new THREE.Object3D()
  items.forEach((item, i) => {
    const { x, y, z } = item
    dummy.position.set(x, y, z)
    dummy.updateMatrix()
    mesh.setMatrixAt(i, dummy.matrix)
    mesh.setColorAt(i, new THREE.Color(colorOf ? colorOf(item) : 0xffffff))
  })
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  return mesh
}

/**
 * 渲染一整个场景：重建四个图层（地面格 / 障碍 / 出口 / 人员球体）。
 * 入参结构与后端请求一致：cells 只存 0/1，exits/agents 为 {row, col} 列表。
 */
function renderGrid({ rows, cols, cells, exits = [], agents = [] }) {
  currentRows = rows
  currentCols = cols

  // 先清掉旧图层，避免叠加
  for (const mesh of [tileMesh, obstacleMesh, exitMesh, agentMesh]) {
    if (mesh) {
      scene.remove(mesh)
      mesh.geometry.dispose()
      mesh.material.dispose()
    }
  }

  // 1) 地面格：每格一块薄板，空地浅色、障碍格深色（作为底座）
  const tileItems = []
  const obstacleItems = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const { x, z } = gridToWorld(r, c)
      const isWall = cells[r][c] === 1
      tileItems.push({ x, y: -0.06, z })
      if (isWall) obstacleItems.push({ x, y: 0.32, z }) // 障碍方块立在格子上
    }
  }
  tileMesh = makeInstanced(
    new THREE.BoxGeometry(0.94, 0.12, 0.94),
    new THREE.MeshStandardMaterial({ roughness: 0.9 }),
    tileItems,
    (item) => COLOR_GROUND_DARK // 底座统一深色，上方障碍再盖高方块
  )
  scene.add(tileMesh)

  // 2) 障碍物：深灰色高方块
  if (obstacleItems.length) {
    obstacleMesh = makeInstanced(
      new THREE.BoxGeometry(0.94, 0.68, 0.94),
      new THREE.MeshStandardMaterial({ roughness: 0.85 }),
      obstacleItems,
      () => COLOR_OBSTACLE
    )
    scene.add(obstacleMesh)
  }

  // 3) 出口：绿色发光方块（略低于障碍，醒目区分）
  if (exits.length) {
    exitMesh = makeInstanced(
      new THREE.BoxGeometry(0.7, 0.22, 0.7),
      new THREE.MeshStandardMaterial({ color: COLOR_EXIT, emissive: COLOR_EXIT, emissiveIntensity: 0.55 }),
      exits.map((e) => ({ ...gridToWorld(e.row, e.col), y: 0.02 })),
      () => COLOR_EXIT
    )
    scene.add(exitMesh)
  }

  // 4) 人员：蓝色小球，浮在格子上方
  if (agents.length) {
    agentMesh = makeInstanced(
      new THREE.SphereGeometry(0.24, 14, 10),
      new THREE.MeshStandardMaterial({ roughness: 0.4 }),
      agents.map((a) => ({ ...gridToWorld(a.row, a.col), y: 0.45 })),
      () => COLOR_AGENT
    )
    scene.add(agentMesh)
  }

  // 5) 相机取景：根据网格尺寸把视野拉远到能看全
  const dim = Math.max(rows, cols)
  camera.position.set(dim * 0.4, dim * 0.95, dim * 1.25)
  controls.target.set(0, 0, 0)
  controls.update()
}

/**
 * 更新人员球体位置（动画用）：positions 与 agents 顺序一致。
 * 数量变化时自动重建网格。
 */
function setAgentPositions(positions) {
  if (!agentMesh || positions.length !== agentMesh.count) {
    // 数量不一致 → 重建（正常动画中数量不变，这里只是兜底）
    if (agentMesh) {
      scene.remove(agentMesh)
      agentMesh.geometry.dispose()
      agentMesh.material.dispose()
      agentMesh = null
    }
    if (!positions.length) return
    agentMesh = makeInstanced(
      new THREE.SphereGeometry(0.24, 14, 10),
      new THREE.MeshStandardMaterial({ roughness: 0.4 }),
      positions.map((p) => ({ ...gridToWorld(p.row, p.col), y: 0.45 })),
      () => COLOR_AGENT
    )
    scene.add(agentMesh)
    return
  }
  const dummy = new THREE.Object3D()
  positions.forEach((p, i) => {
    const { x, z } = gridToWorld(p.row, p.col)
    dummy.position.set(x, 0.45, z)
    dummy.updateMatrix()
    agentMesh.setMatrixAt(i, dummy.matrix)
  })
  agentMesh.instanceMatrix.needsUpdate = true
}

onMounted(initScene)
onBeforeUnmount(disposeScene)

// 暴露给父组件（控制面板 / 页面容器）调用的方法
defineExpose({ renderGrid, setAgentPositions })
</script>

<style scoped>
.grid-canvas {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  background: #f5f6f9;
}
</style>
