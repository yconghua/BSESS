import { createRouter, createWebHashHistory } from 'vue-router'
import LoginView from '../pages/auth/LoginView.vue'
import HomeLayout from '../layouts/HomeLayout.vue'
import HomePageView from '../pages/home/index.vue'
import ProfileView from '../pages/profile/index.vue'
// 工作台（三段式：对象树 + 3D 场景 + 属性面板）
import WorkbenchView from '../pages/workbench/index.vue'
// 系统管理模块
import settingsDb from '../pages/settings/db.vue'
import settingsUsers from '../pages/settings/users.vue'
import settingsInfo from '../pages/settings/info.vue'
import settingsProfile from '../pages/settings/profile.vue'
// 帮助与支持
import helpGuide from '../pages/help/guide.vue'
import { navTopItems, navGroups, defaultNavPath } from '../config/navConfig'
import { useSession } from '../composables/useSession'

// 登录守卫需要会话判断；useSession 内部为纯函数（无生命周期钩子），可在此直接调用
const { isSessionValid, clearSession } = useSession()

// 顶部独立导航项路由：按 key 映射组件（工作台 / 首页），未知 key 回退首页
const topItemMap = {
  workbench: WorkbenchView,
  home: HomePageView
}
const navTopRoutes = navTopItems.map((item) => ({
  path: item.key,
  name: item.key,
  component: topItemMap[item.key] || HomePageView,
  meta: { title: item.title }
}))

// 子项 key → 组件 映射：新增子导航时在此登记对应页面组件
const childComponentMap = {
  // 系统管理
  'settings-1': settingsDb,
  'settings-2': settingsUsers,
  'settings-4': settingsInfo,
  'settings-3': settingsProfile,
  // 帮助与支持
  'help-1': helpGuide
}

// 由导航配置生成下拉子路由：每个子项映射到各自的独立页面组件（标题取自 config）
const navChildren = navGroups.flatMap((group) =>
  group.children.map((child) => ({
    path: child.key,
    name: child.key,
    component: childComponentMap[child.key],
    meta: { title: child.title }
  }))
)

const routes = [
  { path: '/login', name: 'login', component: LoginView },
  {
    path: '/',
    component: HomeLayout,
    children: [
      { path: '', redirect: defaultNavPath },
      ...navTopRoutes,
      ...navChildren,
      { path: 'profile', name: 'profile', component: ProfileView }
    ]
  }
]

const router = createRouter({
  // hash 模式：打包后走 file:// 也能直接定位子路由，不会白屏
  history: createWebHashHistory(),
  routes
})

// 轻量登录守卫：基于 localStorage 中的会话过期时间判断（固定 24 小时有效）
router.beforeEach((to) => {
  const valid = isSessionValid()
  if (!valid) {
    // 过期或缺失：清除陈旧登录态，跳回登录页
    clearSession()
    return to.path === '/login' ? true : '/login'
  }
  if (to.path === '/login') return '/'
  return true
})

export default router
