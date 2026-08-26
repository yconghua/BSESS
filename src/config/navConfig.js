// 左侧导航配置（数据驱动：父项 / 子项 / 顶部项的数量均可自由增减）
//
// - 顶部项（topItem）：直接跳转的独立导航（如「首页」）；
// - 父项（group）：大导航栏标题，点击展开 / 收起其下的小导航；
// - 子项（child）：实际可点击路由，页面位于 pages 对应的文件夹里的 vue。
//
// 想加导航，只改这个文件即可：
//   新增顶部项 → 往 navTopItems 加一个 { key, title }，并在 pages 对应的文件夹里面建页面
//   新增父项   → 往 navGroups 加一个 { title, children: [...] }
//   新增子项   → 往对应父项的 children 加一个 { key, title }，并在 pages 对应的文件夹里面建页面
//   key 会同时用作路由 path（如 home → /home），需保持唯一并与页面文件夹名一致。

// 顶部独立导航项（直接跳转，非下拉分组）
export const navTopItems = [
  { key: 'home', title: '首页' }
]

// 大导航栏分组（每个大导航下有若干小导航）：
//   疏散仿真：3D 场景编辑器 + 场景管理 / 仿真记录（MySQL）
//   数据分析：批量实验（算法对比）+ 算法说明（M3 学术向）
//   系统管理：数据库连接 / 用户管理（MySQL）+ 系统信息 + 个人主页
// 子项 key 与页面文件一一对应：pages/<大组文件夹>/<语义名>.vue
export const navGroups = [
  {
    title: '疏散仿真',
    children: [
      { key: 'evacuation-1', title: '疏散仿真' },
      { key: 'evacuation-2', title: '场景管理' },
      { key: 'evacuation-3', title: '仿真记录' }
    ]
  },
  {
    title: '数据分析',
    children: [
      { key: 'analysis-1', title: '批量实验' },
      { key: 'analysis-2', title: '算法说明' }
    ]
  },
  {
    title: '系统管理',
    children: [
      { key: 'settings-1', title: '数据库连接' },
      { key: 'settings-2', title: '用户管理' },
      { key: 'settings-4', title: '系统信息' },
      { key: 'settings-3', title: '个人主页' }
    ]
  }
]

// 默认重定向：优先顶部项「首页」，否则回退到个人主页
export const defaultNavPath = navTopItems.length
  ? `/${navTopItems[0].key}`
  : '/profile'
