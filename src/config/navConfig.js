// 左侧导航配置（数据驱动：父项 / 子项 / 顶部项的数量均可自由增减）
//
// - 顶部项（topItem）：直接跳转的独立导航（「工作台」为核心页面，「首页」为概览）；
// - 父项（group）：大导航栏标题，点击展开 / 收起其下的小导航；
// - 子项（child）：实际可点击路由，页面位于 pages 对应的文件夹里的 vue。
//
// 设计说明：疏散仿真的全部功能（场景搭建 / 仿真运行 / 结果分析 / 对比论证）
// 已融入「工作台」的三段式布局（左对象树 + 中 3D 场景 + 右属性面板），
// 因此不再按功能拆分为多级导航；左侧仅保留低频的系统管理与帮助入口。
//
// 想加导航，只改这个文件即可：
//   新增顶部项 → 往 navTopItems 加一个 { key, title }，并在 pages 对应的文件夹里面建页面
//   新增父项   → 往 navGroups 加一个 { title, children: [...] }
//   新增子项   → 往对应父项的 children 加一个 { key, title }，并在 pages 对应的文件夹里面建页面
//   key 会同时用作路由 path（如 home → /home），需保持唯一并与页面文件夹名一致。

// 顶部独立导航项（直接跳转，非下拉分组）
export const navTopItems = [
  { key: 'workbench', title: '工作台' },
  { key: 'home', title: '首页' }
]

// 大导航栏分组：仅保留低频配置入口（核心功能在「工作台」内）
//   系统管理：数据库连接 / 用户管理 / 系统信息 / 个人主页
//   帮助与支持：使用指南
// 子项 key 与页面文件一一对应：pages/<大组文件夹>/<语义名>.vue
export const navGroups = [
  {
    title: '系统管理',
    children: [
      { key: 'settings-1', title: '数据库连接' },
      { key: 'settings-2', title: '用户管理' },
      { key: 'settings-4', title: '系统信息' },
      { key: 'settings-3', title: '个人主页' }
    ]
  },
  {
    title: '帮助与支持',
    children: [
      { key: 'help-1', title: '使用指南' }
    ]
  }
]

// 默认重定向：优先顶部项「工作台」，否则回退到个人主页
export const defaultNavPath = navTopItems.length
  ? `/${navTopItems[0].key}`
  : '/profile'
