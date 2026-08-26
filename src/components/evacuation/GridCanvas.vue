<template>
  <div ref="containerRef" class="grid-canvas"></div>
</template>

<script setup>
/**
 * GridCanvas —— Three.js 3D 场景组件。
 *
 * 职责：
 *   1. 渲染网格/障碍/出口/人员（InstancedMesh 四图层）；
 *   2. 左键点击格子 → 发出 cell-click 事件（供控制面板涂绘）；
 *   3. 播放疏散路径动画（playPaths）。
 *
 * 约定（与后端一致）：
 *   - 逻辑层二维网格 grid[row][col]（row 向下、col 向右），三维只是表现层；
 *   - 世界坐标：x = col - (cols-1)/2，z = row - (rows-1)/2（网格居中于原点）；
 *   - cells 只存 0/1；exits / agents 为 {row, col} 叠加层。
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

const COLOR_GROUND = 0xe9edf3
const COLOR_GROUND_DARK = 0xb9c0cc
const COLOR_OBSTACLE = 0x555b66
const COLOR_EXIT = 0x2ecc71
const COLOR_AGENT = 0x3498db

const emit = defineEmits(['cell-click'])

const containerRef = ref(null)

let renderer = null
let scene = null
let camera = null
let controls = null
let animationId = 0
let resizeObserver = null
let raycaster = null
let pointer = null

let tileMesh = null
let obstacleMesh = null
let exitMesh = null
let agentMesh = null
let heatmapMesh = null

// 后端距离场中不可达/障碍格的标记（与 app/algorithms.py 的 INF 一致）
const INF = 10 ** 9

let currentRows = 0
let currentCols = 0
let agentStarts = [] // 人员初始位置（动画中不可达者原地不动）
let animTimer = 0    // 路径动画的 requestAnimationFrame id

/** grid (row, col) → three 世界坐标 */
function gridToWorld(row, col) {
  return {
    x: col - (currentCols - 1) / 2,
    z: row - (currentRows - 1) / 2
  }
}

/** 工具：创建 InstancedMesh 并逐实例设置位置/颜色 */
function makeInstanced(geometry, material, items, colorOf) {
  const mesh = new THREE.InstancedMesh(geometry, material, items.length)
  const dummy = new THREE.Object3D()
  items.forEach((item, i) => {
    dummy.position.set(item.x, item.y, item.z)
    dummy.updateMatrix()
    mesh.setMatrixAt(i, dummy.matrix)
    mesh.setColorAt(i, new THREE.Color(colorOf ? colorOf(item) : 0xffffff))
  })
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  return mesh
}

function clearLayer(mesh) {
  if (mesh) {
    scene?.remove(mesh)
    mesh.geometry.dispose()
    mesh.material.dispose()
  }
}

/** 初始化 Three.js 场景 */
function initScene() {
  const el = containerRef.value
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(el.clientWidth, el.clientHeight)
  el.appendChild(renderer.domElement)

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xf5f6f9)

  camera = new THREE.PerspectiveCamera(50, el.clientWidth / el.clientHeight, 0.1, 2000)
  scene.add(new THREE.AmbientLight(0xffffff, 0.75))
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.1)
  dirLight.position.set(30, 60, 20)
  scene.add(dirLight)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.maxPolarAngle = Math.PI / 2.15

  raycaster = new THREE.Raycaster()
  pointer = new THREE.Vector2()

  // 点击拾取：按下/抬起位移 < 5px 视为「点格子」，拖拽（旋转）不触发
  let downX = 0
  let downY = 0
  renderer.domElement.addEventListener('pointerdown', (e) => {
    downX = e.clientX
    downY = e.clientY
  })
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (Math.abs(e.clientX - downX) > 5 || Math.abs(e.clientY - downY) > 5) return
    pickCell(e)
  })

  const animate = () => {
    animationId = requestAnimationFrame(animate)
    controls.update()
    renderer.render(scene, camera)
  }
  animate()

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

/** 射线拾取格子：命中地面格实例 → 由 instanceId 反推 (row, col) 并发出事件 */
function pickCell(event) {
  if (!tileMesh) return
  const rect = renderer.domElement.getBoundingClientRect()
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(pointer, camera)
  const hits = raycaster.intersectObject(tileMesh)
  if (!hits.length) return
  // 实例顺序 = row * cols + col
  const id = hits[0].instanceId
  emit('cell-click', { row: Math.floor(id / currentCols), col: id % currentCols })
}

/**
 * 渲染整个场景（四图层重建）。
 * 入参：{ rows, cols, cells, exits, agents }，与后端 /simulate 请求体同构。
 */
function renderGrid({ rows, cols, cells, exits = [], agents = [] }) {
  currentRows = rows
  currentCols = cols
  agentStarts = agents.map((a) => ({ row: a.row, col: a.col }))

  for (const mesh of [tileMesh, obstacleMesh, exitMesh, agentMesh, heatmapMesh]) clearLayer(mesh)
  heatmapMesh = null

  // 1) 地面格 + 2) 障碍物（同一次遍历收集）
  const tileItems = []
  const obstacleItems = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const { x, z } = gridToWorld(r, c)
      tileItems.push({ x, y: -0.06, z })
      if (cells[r][c] === 1) obstacleItems.push({ x, y: 0.32, z })
    }
  }
  tileMesh = makeInstanced(
    new THREE.BoxGeometry(0.94, 0.12, 0.94),
    new THREE.MeshStandardMaterial({ roughness: 0.9 }),
    tileItems,
    () => COLOR_GROUND
  )
  scene.add(tileMesh)

  if (obstacleItems.length) {
    obstacleMesh = makeInstanced(
      new THREE.BoxGeometry(0.94, 0.68, 0.94),
      new THREE.MeshStandardMaterial({ roughness: 0.85 }),
      obstacleItems,
      () => COLOR_OBSTACLE
    )
    scene.add(obstacleMesh)
  }

  // 3) 出口：绿色发光块
  if (exits.length) {
    exitMesh = makeInstanced(
      new THREE.BoxGeometry(0.7, 0.22, 0.7),
      new THREE.MeshStandardMaterial({ color: COLOR_EXIT, emissive: COLOR_EXIT, emissiveIntensity: 0.55 }),
      exits.map((e) => ({ ...gridToWorld(e.row, e.col), y: 0.02 })),
      () => COLOR_EXIT
    )
    scene.add(exitMesh)
  }

  // 4) 人员球体
  if (agents.length) {
    agentMesh = makeInstanced(
      new THREE.SphereGeometry(0.24, 14, 10),
      new THREE.MeshStandardMaterial({ roughness: 0.4 }),
      agents.map((a) => ({ ...gridToWorld(a.row, a.col), y: 0.45 })),
      () => COLOR_AGENT
    )
    scene.add(agentMesh)
  }

  // 5) 相机取景：按网格尺寸拉远到能看全
  const dim = Math.max(rows, cols)
  camera.position.set(dim * 0.4, dim * 0.95, dim * 1.25)
  controls.target.set(0, 0, 0)
  controls.update()
}

/** 更新人员球体位置（动画驱动） */
function setAgentPositions(positions) {
  if (!agentMesh || positions.length !== agentMesh.count) {
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

/**
 * 播放路径动画：paths[i] 与 agents 顺序一致（空数组 = 不可达，原地不动）。
 * stepMs：每步耗时（毫秒），对应控制面板「速度」档位。
 */
function playPaths(paths, { stepMs = 200, onFinish } = {}) {
  stopPaths()
  const maxSteps = paths.reduce((m, p) => Math.max(m, p.length ? p.length - 1 : 0), 0)
  // 先归位到各自起点
  applyAgentStep(paths, 0)
  if (!maxSteps) {
    onFinish?.()
    return
  }
  const startTime = performance.now()
  const tick = (now) => {
    const step = Math.min(Math.floor((now - startTime) / stepMs), maxSteps)
    applyAgentStep(paths, step)
    if (step >= maxSteps) {
      animTimer = 0
      onFinish?.()
      return
    }
    animTimer = requestAnimationFrame(tick)
  }
  animTimer = requestAnimationFrame(tick)
}

/** 把所有人推进到第 step 步的位置（不可达者留在起点） */
function applyAgentStep(paths, step) {
  const positions = paths.map((p, i) => (p && p.length ? p[Math.min(step, p.length - 1)] : agentStarts[i]))
  setAgentPositions(positions)
}

/** 停止动画 */
function stopPaths() {
  if (animTimer) {
    cancelAnimationFrame(animTimer)
    animTimer = 0
  }
}

/**
 * 距离场热力图叠加：每格一块半透明色片，颜色按「到最近出口的步数」映射。
 *   近出口 → 蓝色，远 → 红色（hue 240→0）；不可达格 → 深紫；障碍格跳过（上方已有障碍方块）。
 * 传入 null / 空数组则移除热力图。
 */
function setHeatmap(distField) {
  clearLayer(heatmapMesh)
  heatmapMesh = null
  if (!distField || !distField.length || !tileMesh) return

  const items = []
  let maxD = 0
  for (let r = 0; r < currentRows; r++) {
    for (let c = 0; c < currentCols; c++) {
      const d = distField[r]?.[c]
      if (d === undefined) continue
      if (d < INF) maxD = Math.max(maxD, d) // 可达格子的最大距离（含 0）
    }
  }
  for (let r = 0; r < currentRows; r++) {
    for (let c = 0; c < currentCols; c++) {
      const d = distField[r]?.[c]
      if (d === undefined) continue
      const { x, z } = gridToWorld(r, c)
      items.push({ x, y: 0.015, z, d })
    }
  }
  if (!items.length) return

  heatmapMesh = makeInstanced(
    new THREE.BoxGeometry(0.94, 0.03, 0.94),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.5, depthWrite: false }),
    items,
    (item) => {
      if (item.d >= INF) return new THREE.Color(0x7a6a9e) // 不可达：深紫
      const t = maxD > 0 ? item.d / maxD : 0
      return new THREE.Color().setHSL(0.666 - 0.666 * t, 0.85, 0.55) // 蓝(近) → 红(远)
    }
  )
  scene.add(heatmapMesh)
}

/** 移除热力图 */
function clearHeatmap() {
  clearLayer(heatmapMesh)
  heatmapMesh = null
}

function disposeScene() {
  stopPaths()
  cancelAnimationFrame(animationId)
  resizeObserver?.disconnect()
  controls?.dispose()
  for (const mesh of [tileMesh, obstacleMesh, exitMesh, agentMesh, heatmapMesh]) clearLayer(mesh)
  if (renderer) {
    renderer.dispose()
    renderer.domElement.remove()
    renderer = null
  }
}

onMounted(initScene)
onBeforeUnmount(disposeScene)

defineExpose({ renderGrid, setAgentPositions, playPaths, stopPaths, setHeatmap, clearHeatmap })
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
