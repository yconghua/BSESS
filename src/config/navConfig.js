// 左侧导航配置（数据驱动：父项 / 子项 / 顶部项的数量均可自由增减）
//
// - 顶部项（topItem）：直接跳转的独立导航（如「首页」）；
// - 父项（group）：下拉分组标题，点击展开 / 收起其子项；
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

// 下拉分组：三大业务模块（新建项目 / 导入数据 / 计算结果）
// 子项 key 与页面文件一一对应：pages/<大组文件夹>/<语义名>.vue
export const navGroups = [
  {
    title: '示例1',
    children: [
      { key: 'first-1', title: '示例11' },
      { key: 'first-2', title: '示例12' }
    ]
  },
  {
    title: '示例2',
    children: [
      { key: 'second-1', title: '示例21' }
    ]
  },
  {
    title: '示例3',
    children: [
      { key: 'third-1', title: '示例31' },
      { key: 'third-2', title: '示例32' }
    ]
  }
]

// 默认重定向：优先顶部项「首页」，否则回退到个人主页
export const defaultNavPath = navTopItems.length
  ? `/${navTopItems[0].key}`
  : '/profile'
