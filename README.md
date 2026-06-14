<p align="center">
  <picture>
    <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
    <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
    <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="Web AI IDE logo" width="200">
  </picture>
</p>

<p align="center">
  <strong>WEB 课程大作业 —— Web AI IDE</strong><br>
  基于 <a href="https://github.com/anomalyco/opencode">anomalyco/opencode</a> 的 Fork，新增功能与性能优化
</p>

<p align="center">
  <a href="https://github.com/HuiltSun/web-ai-ide"><img alt="GitHub" src="https://img.shields.io/badge/github-HuiltSun%2Fweb--ai--ide-6B8E7D?style=flat-square&logo=github" /></a>
  <a href="https://github.com/HuiltSun/web-ai-ide/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-6B8E7D?style=flat-square" /></a>
</p>

---

## 项目简介

本项目 **Web AI IDE** 基于 [opencode](https://github.com/anomalyco/opencode) 开发，作为 WEB 课程期末大作业提交。Web AI IDE 是一个终端优先的多客户端 AI Coding Agent，支持 TUI、Web、Desktop（Electron / Tauri）多种客户端，后端基于 Hono HTTP Server + SQLite + OAuth。

> **小组成员：** 孙以恒、魏征征

---

## 我们的贡献

### 01 全局搜索面板 `[新增功能]`

VS Code 风格的 `Ctrl+Shift+F` 全局搜索，直接集成于 Electron 客户端。

- 跨文件内容实时检索
- 支持正则表达式与文件名双模式搜索
- 结果高亮 + 快速跳转

### 02 Electron 性能优化 `[工程优化]`

针对 Electron 客户端的 7 项专项性能改进：

- 约 100 行代码改动
- 32 个回归验证测试全覆盖
- 启动速度、渲染响应、内存占用全面提升

### 03 Bun Shell 原生迁移 `[底层重构]`

将 143 处 `child_process` 调用全部迁移至 Bun Shell API：

- 消除 Node.js child_process 依赖
- 性能与跨平台兼容性双提升
- 为后续 Bun 原生部署打下基础

---

## 仓库地址

```
https://github.com/HuiltSun/web-ai-ide
```

---

## 项目架构

分布式 C/S 架构，AI 代理运行环境与用户交互界面物理隔离，通过 RPC/WebSocket 实现跨地域指令分发。

| 层级 | 组件 |
| --- | --- |
| **客户端层** | TUI 终端、Web 浏览器、Desktop (Electron)、Desktop (Tauri) |
| **SDK 层** | `@opencode-ai/sdk` · TypeScript SDK · v1/v2 API |
| **服务端层** | Hono HTTP Server · Agent Runtime · SQLite · OAuth |

---

## 主要包结构

| 包 | 路径 | 说明 |
| --- | --- | --- |
| `opencode` | `packages/opencode` | 核心 CLI：agent 运行时、TUI、存储、认证、HTTP 服务、AI 提供商 |
| `@opencode-ai/app` | `packages/app` | Web GUI（SolidJS + Vite） |
| `@opencode-ai/desktop` | `packages/desktop` | 桌面应用（Tauri） |
| `@opencode-ai/desktop-electron` | `packages/desktop-electron` | 桌面应用（Electron）|
| `@opencode-ai/ui` | `packages/ui` | 共享 UI 组件（SolidJS） |
| `@opencode-ai/sdk` | `packages/sdk/js` | TypeScript SDK |

---

## 本地开发

```bash
# 依赖安装（需要 Bun）
bun install

# 启动 TUI
bun run --cwd packages/opencode dev

# 启动 Web GUI
bun run --cwd packages/app dev

# 启动 Electron
bun run --cwd packages/desktop-electron dev
```

---

## 致谢

本项目基于 [anomalyco/opencode](https://github.com/anomalyco/opencode) 开发，遵循原项目 MIT 许可证。感谢原作者的开源贡献。
