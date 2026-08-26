# 有界空间疏散仿真系统（BoundedSpace Evacuation Simulation System）

> 📅 更新日期：2026年8月26日
>
> 🗂 一个

![Version](https://img.shields.io/badge/version-3.9.1-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)
![Electron](https://img.shields.io/badge/Electron-31-2b2e42)
![Vue](https://img.shields.io/badge/Vue-3.4-42b883)
![MySQL](https://img.shields.io/badge/MySQL-5.7%2B%20%7C%208.x-cb3837)

---

## 📑 目录

- [✨ 功能特性](#功能特性)
- [🛠 技术栈](#技术栈)
- [📁 目录结构](#目录结构)
- [📋 环境要求](#环境要求)
- [🚀 快速开始](#快速开始)
- [📜 常用脚本](#常用脚本)
- [🧩 功能模块](#功能模块)
- [🤝 交互约定](#交互约定)
- [🏗 架构要点](#架构要点)
- [🗺 路线图 / 已知占位](#路线图--已知占位)
- [🤝 参与贡献](#参与贡献)
- [📄 许可证](#许可证)

---

## ✨ 功能特性

- **本地桌面、数据私有**：基于 Electron 打包，主进程直连本地 / 云端 MySQL，无需独立后端服务，数据落库在你自己的数据库。
- **账号与登录守卫**：基于 `localStorage` 的会话过期机制（默认 24h），未登录自动跳回登录页；支持修改密码与用户管理（仅管理员）。
- **数据库连接管理**：登录页可切换 / 添加 / 删除数据库连接；添加时自动建库 + 建表 + 写入默认管理员，多套连接在运行时切换，无需改配置重启。
- **清晰的分层架构**：主进程按「数据层（db）→ 服务层（services）→ 路由层（ipc）→ 入口（main.js）」单向分层，共享常量收敛到 `shared/`；新增业务模块按「schema + repository + service + ipc 路由 + preload 暴露」模板扩展，`main.js` 与核心框架代码几乎不动。
- **可扩展的导航骨架**：左侧导航由 `src/config/navConfig.js` 数据驱动，每个子项对应 `pages/` 下一个独立 `.vue` 文件；新增模块只改配置即可自动生成路由，当前业务模块以「正在开发中」占位，便于后续逐个填充。
- **开发者笔记（本地）**：`DEV_NOTES.md` 仅本地记录、已被 `.gitignore` 忽略，不上传 GitHub。

---

## 🛠 技术栈

| 层 | 技术 |
| --- | --- |
| 前端框架 | Vue 3 (`<script setup>`) + Vue Router 4 |
| 构建工具 | Vite 5 |
| 桌面外壳 | Electron 31 |
| 数据库 | MySQL（通过 `mysql2` 驱动） |
| 认证 | `bcryptjs`（密码哈希） |
| 打包 | `electron-builder` |

---

## 📁 目录结构


---

## 📋 环境要求



## 🚀 快速开始



## 📜 常用脚本

## 🗺 路线图 / 已知占位


## 🤝 参与贡献


## 📄 许可证

[MIT](https://opensource.org/licenses/MIT) © conghua


⭐ 如果这个项目对你有帮助，欢迎 Star 支持：

