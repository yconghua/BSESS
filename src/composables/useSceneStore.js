/**
 * useSceneStore —— 跨页面传递「待加载的场景」
 *
 * 场景管理页点「加载」→ setPendingScene(scenario) → 跳转疏散页；
 * 疏散页 onMounted → takePendingScene() 取出并应用（只消费一次）。
 * 模块级单例，页面切换不丢失。
 */
let pendingScene = null

export function setPendingScene(scene) {
  pendingScene = scene
}

export function takePendingScene() {
  const scene = pendingScene
  pendingScene = null
  return scene
}
