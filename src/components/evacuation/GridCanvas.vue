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
let pathGroup = null // 路径线条组（路径查看页用）

// 后端距离场中不可达/障碍格的标记（与 app/algorithms.py 的 INF 一致）
const INF = 10 ** 9

let currentRows = 0
let currentCols = 0
let agentStarts = [] // 人员初始位置（动画中不可达者原地不动）
// 路径动画状态（支持暂停/继续）
let anim = null // {paths, effStepMs, maxSteps, elapsed, startTime, lastStep, onStep, onFinish, paused, rafId, loop}

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
  clearPaths()

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
 * 播放路径动画：paths[i] 与 agents 顺序一致（空数组 = 不可达，原地不动并染红高亮）。
 * stepMs：每步耗时（毫秒）；支持平滑插值与暂停/继续；onStep(step, done, total) 每步触发。
 */
function playPaths(paths, { stepMs = 200, onStep, onFinish } = {}) {
  stopPaths()
  // 不可达者（空路径）：保持起点并染红高亮
  const unreachable = []
  paths.forEach((p, i) => {
    if (!p || !p.length) unreachable.push(i)
  })
  const maxSteps = paths.reduce((m, p) => Math.max(m, p && p.length ? p.length - 1 : 0), 0)
  // 长轨迹自动提速：SFM/CA 轨迹可能上千点，总动画时长钳制在 60s 内
  const effStepMs = maxSteps > 0 ? Math.max(1, Math.min(stepMs, 60000 / maxSteps)) : stepMs
  // 归位到起点 + 标记不可达
  applyAgentSmooth(paths, 0)
  markUnreachable(unreachable)
  if (!maxSteps) {
    onStep?.(0, 0, 0)
    onFinish?.()
    return
  }
  const loop = (now) => {
    if (!anim) return
    const t = Math.min((anim.elapsed + (now - anim.startTime)) / anim.effStepMs, anim.maxSteps)
    const step = Math.floor(t)
    if (step !== anim.lastStep) {
      anim.lastStep = step
      // 已撤人数：路径已走到末尾且非原地（长度>1）即视为到达出口
      const done = paths.reduce((n, p) => n + (p && p.length > 1 && step >= p.length - 1 ? 1 : 0), 0)
      anim.onStep?.(step, done, anim.maxSteps)
    }
    applyAgentSmooth(paths, t)
    if (t >= anim.maxSteps) {
      anim = null
      onFinish?.()
      return
    }
    anim.rafId = requestAnimationFrame(loop)
  }
  anim = {
    paths, effStepMs, maxSteps,
    elapsed: 0, startTime: performance.now(), lastStep: -1,
    onStep, onFinish, paused: false, rafId: 0, loop
  }
  anim.rafId = requestAnimationFrame(loop)
}

/** 暂停动画（保留进度，可 resumePaths 继续） */
function pausePaths() {
  if (!anim || anim.paused) return
  anim.elapsed += performance.now() - anim.startTime
  cancelAnimationFrame(anim.rafId)
  anim.paused = true
  anim.rafId = 0
}

/** 继续播放 */
function resumePaths() {
  if (!anim || !anim.paused) return
  anim.paused = false
  anim.startTime = performance.now()
  anim.rafId = requestAnimationFrame(anim.loop)
}

/** 是否正在播放中 */
function isPlaying() {
  return !!anim
}

/** 平滑推进：在 path[idx] 与 path[idx+1] 之间线性插值（重复点 → 原地停留，即排队效果） */
function applyAgentSmooth(paths, t) {
  const positions = paths.map((p, i) => {
    if (!p || !p.length) return agentStarts[i] // 不可达：留在起点
    const idx = Math.min(Math.floor(t), p.length - 1)
    const nxt = Math.min(idx + 1, p.length - 1)
    const frac = t - Math.floor(t)
    const a = p[idx]
    const b = p[nxt]
    return { row: a.row + (b.row - a.row) * frac, col: a.col + (b.col - a.col) * frac }
  })
  setAgentPositions(positions)
}

/** 把指定索引的人员球体染红（不可达高亮） */
function markUnreachable(indices) {
  if (!agentMesh || !indices.length) return
  const red = new THREE.Color(0xe74c3c)
  indices.forEach((i) => {
    if (i < agentMesh.count) agentMesh.setColorAt(i, red)
  })
  if (agentMesh.instanceColor) agentMesh.instanceColor.needsUpdate = true
}

/** 停止动画 */
function stopPaths() {
  if (anim) {
    cancelAnimationFrame(anim.rafId)
    anim = null
  }
}

/**
 * 渲染全部人员的路径线条（路径查看页用）：每人一条折线，颜色循环区分。
 * 传入 null 则清除。
 */
function renderPaths(paths) {
  clearPaths()
  if (!paths) return
  pathGroup = new THREE.Group()
  const colors = [0x185fa5, 0x0f6e56, 0xba7517, 0x7f77dd, 0xd85a30, 0x993556, 0x3b6d11, 0x993c1d]
  paths.forEach((p, i) => {
    if (!p || p.length < 2) return
    const pts = p.map((pt) => {
      const { x, z } = gridToWorld(pt.row, pt.col)
      return new THREE.Vector3(x, 0.5, z)
    })
    const geo = new THREE.BufferGeometry().setFromPoints(pts)
    const mat = new THREE.LineBasicMaterial({ color: colors[i % colors.length], transparent: true, opacity: 0.85 })
    pathGroup.add(new THREE.Line(geo, mat))
  })
  scene.add(pathGroup)
}

/** 清除路径线条 */
function clearPaths() {
  if (pathGroup) {
    scene?.remove(pathGroup)
    pathGroup.traverse((o) => {
      o.geometry?.dispose?.()
      o.material?.dispose?.()
    })
    pathGroup = null
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
  clearPaths()
  if (renderer) {
    renderer.dispose()
    renderer.domElement.remove()
    renderer = null
  }
}

onMounted(initScene)
onBeforeUnmount(disposeScene)

defineExpose({ renderGrid, setAgentPositions, playPaths, pausePaths, resumePaths, stopPaths, isPlaying, renderPaths, clearPaths, setHeatmap, clearHeatmap })
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
