# 有界空间疏散仿真系统（BSESS）

**BoundedSpace Evacuation Simulation System** — 面向任意封闭空间的桌面疏散路径规划工具。

> 不依赖任何外部地图文件：用户在工作台中自定义空间尺寸、布置障碍物与出口、选择算法，即可获得疏散路径方案与三维可视化动画。所有数据仅存本机，不上传云端。

![Version](https://img.shields.io/badge/version-1.2.0-blue)
![Electron](https://img.shields.io/badge/Electron-31-2b2e42)
![Vue](https://img.shields.io/badge/Vue-3.4-42b883)
![Three.js](https://img.shields.io/badge/Three.js-0.185-000000)
![FastAPI](https://img.shields.io/badge/FastAPI-0.141-009688)
![MySQL](https://img.shields.io/badge/MySQL-5.7%2B%20%7C%208.x-cb3837)

---

## 目录

- [一、项目简介](#一项目简介)
- [二、核心特性](#二核心特性)
- [三、技术架构](#三技术架构)
- [四、目录结构](#四目录结构)
- [五、环境要求](#五环境要求)
- [六、快速开始](#六快速开始)
- [七、工作台使用指南](#七工作台使用指南)
- [八、算法说明](#八算法说明)
- [九、HTTP API（FastAPI）](#九http-apifastapi)
- [十、IPC 接口（Electron 主进程）](#十ipc-接口electron-主进程)
- [十一、数据库表结构](#十一数据库表结构)
- [十二、后端进程管理](#十二后端进程管理)
- [十三、常见问题](#十三常见问题)
- [十四、开发路线图](#十四开发路线图)
- [十五、许可证](#十五许可证)

---

## 一、项目简介

本系统面向**任何具有明确物理边界的封闭区域**（建筑房间、车厢、船舱、机舱、临时围场、地下通道等），让用户：

1. **搭建空间**：在三维场景中绘制网格、布置障碍物、标记出口、放置人员；
2. **运行仿真**：选择六种疏散算法之一，由 Python 后端计算疏散路径；
3. **分析结果**：查看统计报表、路径轨迹、距离场热力图、出口分流；
4. **对比论证**：同场景跑全部算法、参数扫描（密度/网格/出口数）、场景横向比较、导出报告。

**v1 定位**：路径级疏散可视化 + 多智能体仿真（CA / SFM）。个体间冲突由 CA / SFM 模型处理；更精细的实时重路由与三维体素（多楼层）规划在后续版本。

**数据安全**：默认不联网、不上传任何数据；场景与仿真记录保存在本机 MySQL，数据不出本机。

---

## 二、核心特性

- **三段式工作台**：左侧对象树 + 中央 3D 场景 + 右侧上下文属性面板。「点中什么就操作什么」，无需记忆功能入口。
- **六种疏散算法**：多源距离场、Dijkstra、A*、BFS、CA 元胞自动机、社交力模型（SFM），支持一键对比与耗时统计。
- **三维可视化**：Three.js 渲染（障碍方块 / 出口发光块 / 人员球体 / 路径折线 / 距离场热力图），平滑插值动画，暂停/继续/调速。
- **实时反馈**：疏散进度 HUD（已疏散人数 / 当前步数）、不可达人员红色高亮、选中实体琥珀高亮 + 相机聚焦。
- **MySQL 持久化**：用户体系（登录/注册/角色）、场景库保存/加载、仿真记录自动落库。
- **场景互通**：场景 JSON 导出/导入；全算法 HTML 报告（浏览器打开可另存 PDF）。
- **桌面一体化**：Electron 启动自动拉起 Python 计算服务（复用已运行实例），退出自动清理进程，无孤儿进程。

---

## 三、技术架构

```
┌────────────────────────────────────────────────────────────┐
│                    Electron 31 桌面壳                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Vue 3 + Vite 渲染层（工作台）              │  │
│  │   ┌────────────┐ ┌──────────────────────────────┐   │  │
│  │   │ 对象树      │ │  Three.js 3D 场景            │   │  │
│  │   │ 空间/障碍/  │ │  实体拾取·高亮·聚焦·动画·热力图│   │  │
│  │   │ 出口/人员/  │ └──────────────────────────────┘   │  │
│  │   │ 仿真/结果   │ ┌──────────────────────────────┐   │  │
│  │   │            │ │ 上下文属性面板（随选中切换）  │   │  │
│  │   └────────────┘ └──────────────────────────────┘   │  │
│  └──────────────────────────────┬───────────────────────┘  │
│                                 │ HTTP（localhost）        │
│  ┌──────────────────────────────▼───────────────────────┐  │
│  │      Python FastAPI 计算服务（sidecar，自动管理）     │  │
│  │  · 距离场 · Dijkstra · A* · BFS · CA · SFM           │  │
│  └──────────────────────────────┬───────────────────────┘  │
│                                 │ IPC（Electron 主进程管库）│
│  ┌──────────────────────────────▼───────────────────────┐  │
│  │         MySQL 本地数据库（user/scenario/             │  │
│  │                      simulation_record）             │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

**分层职责**：

| 层 | 技术 | 职责 |
| --- | --- | --- |
| 桌面壳 | Electron 31 | 窗口、进程管理（拉起/清理 Python 服务）、IPC 路由 |
| 渲染层 | Vue 3 + Vite + Three.js | 工作台交互、3D 场景、动画播放、图表展示 |
| 计算服务 | Python FastAPI（`app/`） | 网格 → 距离场/路径/统计，纯内存计算，不碰数据库 |
| 数据层 | MySQL | 用户、场景、仿真记录（由 Electron 主进程读写，方案 A） |

**"三维"定义**：逻辑层始终是二维网格 `grid[row][col]`（4 邻接等权），Three.js 只是表现层。真三维体素（多楼层）属后续版本。

---

## 四、目录结构

```
BSESS/
├── app/                          # Python 计算服务（FastAPI，独立于 Electron）
│   ├── main.py                   # 入口：/health /algorithms /simulate + 校验
│   ├── algorithms.py             # 六种算法实现（距离场/Dijkstra/A*/BFS/CA/SFM）
│   ├── schemas.py                # Pydantic 请求/响应模型
│   └── __init__.py
├── electron/                     # Electron 主进程
│   ├── main.js                   # 窗口与生命周期（启动时拉起后端、退出清理）
│   ├── preload.js                # contextBridge 暴露 window.api
│   ├── services/                 # 业务服务
│   │   ├── backendService.js     # Python sidecar 进程管理
│   │   ├── authService.js        # 登录/注册/用户管理
│   │   ├── scenarioService.js    # 场景 CRUD（按用户隔离）
│   │   ├── simulationRecordService.js  # 仿真记录 CRUD
│   │   └── connectionService.js  # MySQL 连接管理 + schema 版本重放
│   ├── ipc/                      # IPC 路由（auth:/sys:/backend:/scenario:/sim:）
│   └── db/
│       ├── connection.js         # 连接池/事务
│       ├── repositories/         # Repository 层（user/scenario/simulation_record）
│       └── schemas/              # 01_users.sql / 02_scenario.sql / 03_simulation_record.sql
├── shared/constants.js           # 前后端共享常量
├── src/                          # Vue 渲染层
│   ├── pages/workbench/          # 三段式工作台（核心页面）
│   ├── pages/home/               # 首页
│   ├── pages/settings/           # 数据库连接/用户管理/系统信息/个人主页
│   ├── pages/help/guide.vue      # 使用指南
│   ├── components/workbench/     # EntityTree / PropertyPanel
│   ├── components/evacuation/    # GridCanvas（3D 场景）/ SceneCanvas
│   ├── composables/              # useWorkspace / useSimulation / useSession / useSceneStore
│   ├── config/navConfig.js       # 导航配置（数据驱动）
│   └── router/index.js           # 路由 + 登录守卫
├── .venv/                        # Python 虚拟环境（项目根目录）
├── requirements.txt              # Python 依赖（fastapi/uvicorn）
├── package.json                  # 前端/Electron 依赖与脚本
└── DEV_NOTES.md                  # 开发者设计笔记（本地，不入库）
```

---

## 五、环境要求

| 组件 | 要求 |
| --- | --- |
| Node.js | ≥ 18（开发环境 22.x） |
| Python | ≥ 3.10（开发环境 3.13） |
| MySQL | 5.7+ / 8.x（本机或局域网，登录页配置连接） |
| 操作系统 | Windows / macOS / Linux（Electron 跨平台） |

> 国内网络：npm 已配置 npmmirror 镜像；Python 依赖建议使用国内 PyPI 镜像安装（如 `-i https://mirrors.cloud.tencent.com/pypi/simple/`）。

---

## 六、快速开始

### 1. 安装依赖

```bash
# 前端 / Electron 依赖
npm install

# Python 依赖（虚拟环境在项目根目录 .venv）
# Windows:
.venv\Scripts\python -m pip install -r requirements.txt
# macOS / Linux:
.venv/bin/python -m pip install -r requirements.txt
```

### 2. 启动应用（推荐）

```bash
npm run dev        # 同时启动 Vite(5173) 与 Electron
```

Electron 启动后会自动拉起 Python 计算服务（复用已运行的实例，端口动态分配），并自动建库建表（版本变更时重放 `electron/db/schemas/*.sql`）。**无需手动启动 uvicorn。**

### 3. 纯浏览器调试（可选）

```bash
npm run vite       # 仅启动前端，后端需手动启动：
.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### 4. 登录

- 默认管理员：`admin / admin123`（首次建表自动创建）；
- 也可在登录页「注册账号」自助注册普通用户；
- 首次使用需先在登录页配置一个 MySQL 连接（点数据库状态条）。

---

## 七、工作台使用指南

登录后默认进入**工作台**，三段式布局：

```
┌────────────────────────────────────────────────────────────┐
│ 疏散仿真工作台                    [导出场景][导入场景][导出报告]│
├────────────┬──────────────────────────────┬────────────────┤
│  对象树      │  3D 场景                      │  属性面板        │
│ ▸ 空间      │  · 点击实体 → 琥珀高亮 + 聚焦  │  随选中对象切换   │
│ ▸ 障碍物 N  │  · 切换绘制模式涂绘           │  · 空间: 行列/绘制│
│ ▸ 出口 N    │  · 左键拖动旋转/滚轮缩放      │  · 障碍: 坐标/删除│
│ ▸ 人员 N    │                               │  · 出口: 分流人数 │
│ ▸ 仿真      │                               │  · 人员: 路径详情 │
│ ▸ 结果      │                               │  · 仿真: 算法/控制│
└────────────┴──────────────────────────────┴────────────────┘
```

**典型操作闭环**：

1. **建空间**：点对象树「空间」（或点 3D 空白处）→ 右侧输入行列（3~300）→「生成 / 重建空间」；
2. **布环境**：右侧「绘制工具」切到 障碍 / 出口 / 人员 → 点击格子涂绘；支持随机生成 N 人；
3. **跑仿真**：点「仿真」→ 选算法（多源距离场默认）→「▶ 开始疏散」→ 3D 播放动画，HUD 实时显示进度；
4. **看结果**：点「结果」→ 统计报表 / 路径查看 / 热力诊断 / 出口分流 四个子面板切换；
5. **存与导出**：顶部「导出场景」（JSON）/「导入场景」/「导出报告」（全算法 HTML，Ctrl+P 存 PDF）。

> 在 3D 场景中直接点击任意障碍/出口/人员，或点对象树中的条目，即可定位并操作该实体——无需记忆任何功能入口。

---

## 八、算法说明

| 算法 | id | 类型 | 说明 | 适用 |
| --- | --- | --- | --- | --- |
| 多源距离场 | `distanceField` | 距离类（默认） | 所有出口一次反向 BFS 生成距离场，人员沿梯度下降，自动分流 | 多出口 / 大网格 |
| Dijkstra | `dijkstra` | 距离类 | 优先队列多源最短路，等权网格与距离场等价 | 有权图 / 教学对照 |
| A* | `astar` | 距离类 | 多目标 A*（曼哈顿启发式），只搜必要区域 | 单出口 / 大体量 |
| BFS | `bfs` | 距离类 | 单源 BFS 逐人搜索，固定 4 邻接 | 无权图 / 教学演示 |
| CA 元胞自动机 | `ca` | 多智能体 | 逐格步进 + 同格冲突消解，等待计入路径 | 排队 / 拥堵研究 |
| 社交力模型 | `sfm` | 多智能体 | Helbing 模型：期望力 + 障碍/人际排斥，连续坐标仿真 | 密度 / 拥挤研究 |

**口径**：四种距离类算法最优代价一致（差异在计算耗时）；CA / SFM 的总步数含拥堵等待，为真实疏散时长。

---

## 九、HTTP API（FastAPI）

服务地址：Electron 环境由主进程动态分配（经 `window.api.backend.status()` 获取）；浏览器调试默认 `http://127.0.0.1:8000`。

| 端点 | 方法 | 说明 |
| --- | --- | --- |
| `/health` | GET | 健康检查（Electron 启动时轮询就绪） |
| `/algorithms` | GET | 可用算法列表（含 recommended / scenario / description） |
| `/simulate` | POST | 执行疏散计算 |

### POST /simulate

**请求体**

```json
{
  "grid": [[0,0,1,0,1,0], ...],
  "exits": [{"row":5,"col":8}, {"row":2,"col":20}],
  "agents": [{"row":3,"col":4}, {"row":15,"col":12}],
  "algorithm": "distanceField"
}
```

**响应体**

```json
{
  "agentPaths": [[{"row":3,"col":4}, ...], ...],
  "stats": {
    "totalSteps": 45,
    "avgPathLength": 12.3,
    "maxPathLength": 18,
    "unreachableCount": 0,
    "exitDistribution": [{"row":5,"col":8,"count":23}, ...]
  },
  "distanceField": [[0,1,2,3,...], ...],
  "computationTime": 12.5
}
```

**错误码**（统一 HTTP 400 + `{"code","message"}`）：

| code | 含义 |
| --- | --- |
| `INVALID_SIZE` | 网格尺寸越界（行/列须 3~300）或行长度不一致 |
| `INVALID_CELL` | 格值非法（只允许 0/1） |
| `NO_EXIT` / `NO_AGENT` | 缺少出口 / 人员 |
| `INVALID_POSITION` | 出口/人员越界或落在障碍格 |
| `OVERCROWDED` | 人员数超过空地格数 |

---

## 十、IPC 接口（Electron 主进程）

渲染层通过 preload 暴露的 `window.api` 调用：

| 命名空间 | 方法 | 说明 |
| --- | --- | --- |
| `api.auth` | login / register / logout / getCurrentUser / changePassword / listUsers / createUser / updateUser / deleteUser | 认证与用户管理 |
| `api.sys` | info / dbInfo / dbConnections / switchDb / addDb / deleteDb | 系统信息与数据库连接管理 |
| `api.backend` | status / start / stop / onStatusChanged | Python 计算服务进程管理 |
| `api.scenario` | save / list / get / remove | 场景库 CRUD（MySQL，按用户隔离） |
| `api.simRecord` | save / list / get | 仿真记录（含完整路径，供导出/回放） |

---

## 十一、数据库表结构

由 `electron/db/schemas/` 幂等创建；`package.json` 版本号变化时自动全量重放（SQL 均 `IF NOT EXISTS`，安全）。

### user（系统用户）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | INT UNSIGNED AI PK | 主键 |
| username | VARCHAR(50) UNIQUE | 登录账号 |
| password | VARCHAR(100) | bcrypt 哈希 |
| role | VARCHAR(20) | admin / user |
| created_at | DATETIME | 创建时间 |

### scenario（疏散场景）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | INT UNSIGNED AI PK | 主键 |
| user_id | INT UNSIGNED | 归属用户 |
| name / description | VARCHAR / VARCHAR | 名称与描述 |
| grid_data / exits / agents | JSON | 地形 {rows,cols,cells}、出口、人员叠加层 |
| settings | JSON | 算法等可选设置 |
| created_at / updated_at | DATETIME | 时间戳 |

### simulation_record（仿真记录）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | INT UNSIGNED AI PK | 主键 |
| scenario_id | INT UNSIGNED NULL | 关联场景（可空） |
| user_id | INT UNSIGNED | 归属用户 |
| algorithm | VARCHAR(32) | 算法 id |
| stats / paths | JSON | 统计快照与路径快照 |
| computation_time_ms | FLOAT | 计算耗时 |
| created_at | DATETIME | 仿真时间 |

---

## 十二、后端进程管理

`electron/services/backendService.js` 负责 Python sidecar 的完整生命周期：

1. **端口选择**：首选 8000；被占用则申请随机空闲端口（支持 `BSESS_BACKEND_PORT` 环境变量覆盖）；
2. **复用检测**：首选端口上已有健康的 BSESS 服务（如手动启动的 uvicorn）→ 直接复用，不重复拉起、退出时不误杀；
3. **拉起**：`<.venv>/python -m uvicorn app.main:app`（cwd = 项目根目录）；
4. **健康检查**：轮询 `GET /health`，超时 30s；
5. **清理**：应用退出时用 `taskkill /T /F`（Windows）杀掉进程树，无孤儿进程；
6. **状态广播**：`backend:status-changed` 事件实时推送渲染层（系统信息页可查看）。

---

## 十三、常见问题

**Q：点「开始疏散」提示连不上后端？**
桌面端会自动拉起计算服务（「系统信息」页可查看状态）；纯浏览器调试需手动启动 uvicorn。

**Q：保存场景 / 仿真记录功能不可用？**
依赖本地 MySQL，仅在 Electron 桌面应用内可用；浏览器开发模式为只读。

**Q：为什么四种距离类算法结果一样？**
4 邻接等权网格上它们的最短路径代价一致，差异只在计算方式与耗时——这正是对比报告的看点。

**Q：动画里有人站着不动还变红了？**
红色代表「不可达」：该人员起点被障碍包围、无法到达任何出口，请调整障碍布局或出口位置。

**Q：CA / SFM 的"总步数"为什么比最短路大很多？**
多智能体仿真包含排队等待时间（等待会计入路径），数值越大说明出口越拥堵，可尝试增加出口或调整布局。

**Q：三维场景如何操作？**
左键拖动旋转视角、右键平移、滚轮缩放；「选择」模式下点击实体可高亮并聚焦。

---

## 十四、开发路线图

| 阶段 | 内容 | 状态 |
| --- | --- | --- |
| M0 | 全链路打通（网格 → 算法 → 动画 → 统计） | ✅ 完成 |
| M1 | 交互完善（拾取/热力图/速度/导出导入/场景入库） | ✅ 完成 |
| M2 | 数据持久化（场景库、仿真记录） | ✅ 完成 |
| M3 | 学术扩展（CA 元胞自动机、SFM、批量对比） | ✅ 完成 |
| 工作台重构 | 三段式布局（对象树 + 3D + 属性面板） | ✅ 完成 |
| M4 | PyInstaller 打包 / 安装程序 | ⏸️ 按用户要求不做 |
| 后续 | 仿真记录 3D 回放、CA/SFM 参数面板、多边形自由绘制、真三维体素 | 📋 规划中 |

---

## 十五、许可证

[MIT](https://opensource.org/licenses/MIT) © conghua

---

⭐ 如果这个项目对你有帮助，欢迎 Star 支持。感谢支持。
