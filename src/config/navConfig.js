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
//   场景：空间新建 / 障碍布置 / 出口标记 / 人员设定 —— 仿真前的空间搭建与环境配置
//   仿真：算法选择 / 疏散运行 / 过程控制 / 实时进度 —— 执行疏散计算并控制仿真过程
//   分析：统计报表 / 路径查看 / 热力诊断 / 出口分流 —— 单次仿真结果多维度评估
//   对比：算法对比 / 参数对比 / 场景对比 / 报告导出 —— 多轮实验对照与论文论证
//   系统管理：数据库连接 / 用户管理 / 系统信息 / 个人主页
//   帮助与支持：使用指南
// 子项 key 与页面文件一一对应：pages/<大组文件夹>/<语义名>.vue
export const navGroups = [
  {
    title: '场景',
    children: [
      { key: 'scene-new', title: '空间新建' },
      { key: 'scene-obstacle', title: '障碍布置' },
      { key: 'scene-exit', title: '出口标记' },
      { key: 'scene-agent', title: '人员设定' }
    ]
  },
  {
    title: '仿真',
    children: [
      { key: 'sim-algo', title: '算法选择' },
      { key: 'sim-run', title: '疏散运行' },
      { key: 'sim-control', title: '过程控制' },
      { key: 'sim-progress', title: '实时进度' }
    ]
  },
  {
    title: '分析',
    children: [
      { key: 'anl-report', title: '统计报表' },
      { key: 'anl-paths', title: '路径查看' },
      { key: 'anl-heatmap', title: '热力诊断' },
      { key: 'anl-split', title: '出口分流' }
    ]
  },
  {
    title: '对比',
    children: [
      { key: 'cmp-algo', title: '算法对比' },
      { key: 'cmp-param', title: '参数对比' },
      { key: 'cmp-scene', title: '场景对比' },
      { key: 'cmp-report', title: '报告导出' }
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
  },
  {
    title: '帮助与支持',
    children: [
      { key: 'help-1', title: '使用指南' }
    ]
  }
]

// 默认重定向：优先顶部项「首页」，否则回退到个人主页
export const defaultNavPath = navTopItems.length
  ? `/${navTopItems[0].key}`
  : '/profile'
