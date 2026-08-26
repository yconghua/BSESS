import { createRouter, createWebHashHistory } from 'vue-router'
import LoginView from '../pages/auth/LoginView.vue'
import HomeLayout from '../layouts/HomeLayout.vue'
import HomePageView from '../pages/home/index.vue'
import ProfileView from '../pages/profile/index.vue'
// 三大业务模块的子页面（每个小导航栏一个独立文件，不复用通用占位）
import firstone from '../pages/thefirst/one.vue'
import firsttwo from '../pages/thefirst/two.vue'
import secondone from '../pages/thesecond/one.vue'
import thirdone from '../pages/thethird/one.vue'
import thirdtwo from '../pages/thethird/two.vue'
import { navTopItems, navGroups, defaultNavPath } from '../config/navConfig'
import { useSession } from '../composables/useSession'

// 登录守卫需要会话判断；useSession 内部为纯函数（无生命周期钩子），可在此直接调用
const { isSessionValid, clearSession } = useSession()

// 顶部独立导航项路由（如「首页」）；当前仅有首页，均指向 HomePageView
// 后续新增顶部项时，在此按 item.key 映射对应页面组件
const navTopRoutes = navTopItems.map((item) => ({
  path: item.key,
  name: item.key,
  component: HomePageView,
  meta: { title: item.title }
}))

// 子项 key → 组件 映射：新增子导航时在此登记对应页面组件（key 与 pages对应文件夹里面的 vue 对应）
const childComponentMap = {
  'first-1': firstone,
  'first-2': firsttwo,
  'second-1': secondone,
  'third-1': thirdone,
  'third-2': thirdtwo
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
