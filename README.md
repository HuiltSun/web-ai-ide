<p align="center">
  <picture>
    <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
    <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
    <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="Web AI IDE logo" width="200">
  </picture>
</p>

<p align="center">
  <strong>Web AI IDE</strong><br>
  终端优先的多客户端 AI Coding Agent
</p>
![alt text](image.png)
<p align="center">
  <a href="https://github.com/HuiltSun/web-ai-ide"><img alt="GitHub" src="https://img.shields.io/badge/github-HuiltSun%2Fweb--ai--ide-6B8E7D?style=flat-square&logo=github" /></a>
  <a href="https://github.com/HuiltSun/web-ai-ide/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-6B8E7D?style=flat-square" /></a>
  <a href="https://github.com/anomalyco/opencode"><img alt="Based on" src="https://img.shields.io/badge/based%20on-opencode-4B7BE5?style=flat-square" /></a>
</p>

---

Web AI IDE 是基于 [opencode](https://github.com/anomalyco/opencode) 的 Fork，支持 TUI、Web、Desktop（Electron / Tauri）多种客户端，后端采用 Hono HTTP Server + SQLite + OAuth 架构。在原项目基础上新增了代码神经图可视化、全局搜索面板等功能，并完成了多项底层性能优化。

> 本仓库为 WEB 课程期末大作业，小组成员：孙以恒、魏征征

---

## 新增功能与优化

### Neural Map 代码神经图

将代码仓库可视化为力导向神经图，并内置 AI 对话引导用户逐模块理解代码：

- **拓扑可视化** — 自动分析目录结构、import 依赖与 Git 活跃度，生成带权有向图
- **自研布局引擎** — Fruchterman-Reingold 力导向算法，无第三方依赖，支持平移/缩放/钻取
- **内联 AI 对话** — 选中节点后直接在图旁发起多轮对话，不跳转页面
- **学习进度持久化** — SQLite 存储"已理解"标记与笔记，支持进度条展示
- **Agent 上下文接口** — `GET /neural-map/context` 返回 Markdown 格式的代码库拓扑摘要，供 AI Agent 直接消费，解决 Agent 冷启动时缺乏代码库全局视图的问题

### 全局搜索面板

VS Code 风格的 `Ctrl+Shift+F` 全局搜索，集成于 Electron 客户端：跨文件实时检索，支持正则表达式与文件名双模式，结果高亮 + 快速跳转。

### Electron 性能优化

针对 Electron 客户端的 7 项专项改进：约 100 行代码改动，32 个回归验证测试全覆盖，启动速度、渲染响应与内存占用全面提升。

### Bun Shell 原生迁移

将 143 处 `child_process` 调用迁移至 Bun Shell API，消除 Node.js 子进程依赖，提升性能与跨平台兼容性。

---

## 快速开始

**前置要求：** [Bun](https://bun.sh) >= 1.3

```bash
git clone https://github.com/HuiltSun/web-ai-ide.git
cd web-ai-ide
bun install
```

```bash
# 启动 TUI
bun run --cwd packages/opencode dev

# 启动 Web GUI
bun run --cwd packages/app dev

# 启动 Electron 桌面端
bun run --cwd packages/desktop-electron dev
```

---

## 项目架构

```
客户端层   TUI · Web · Desktop (Electron / Tauri)
              ↕  HTTP / WebSocket
服务端层   Hono Server · Agent Runtime · SQLite · OAuth
```

| 包 | 路径 | 说明 |
|---|---|---|
| `opencode` | `packages/opencode` | 核心 CLI：Agent 运行时、TUI、HTTP 服务、存储、认证 |
| `@opencode-ai/app` | `packages/app` | Web GUI（SolidJS + Vite） |
| `@opencode-ai/desktop-electron` | `packages/desktop-electron` | Electron 桌面壳 |
| `@opencode-ai/desktop` | `packages/desktop` | Tauri 桌面壳 |
| `@opencode-ai/ui` | `packages/ui` | 共享 UI 组件库 |
| `@opencode-ai/sdk` | `packages/sdk/js` | TypeScript SDK |

完整技术栈、架构图、Neural Map 实现细节及 API 文档见 [PROJECT.md](./PROJECT.md)。

---

## Contributing

欢迎提交 Issue 和 PR。请遵循 Conventional Commits 规范，PR 标题格式：`feat:` / `fix:` / `docs:` / `chore:`。

详见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

---

## License

MIT — 详见 [LICENSE](./LICENSE)。

本项目基于 [anomalyco/opencode](https://github.com/anomalyco/opencode) 开发，遵循原项目 MIT 许可证，感谢原作者的开源贡献。
