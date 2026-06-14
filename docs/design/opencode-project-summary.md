# OpenCode 项目汇报

**汇报日期**: 2026-05-12  |  **汇报对象**: 技术团队

---

## 一、项目概览

OpenCode 是一个开源的 AI 编程代理（AI Coding Agent），采用终端优先（TUI-first）设计理念。

| 项目信息 | 详情 |
|---------|------|
| 定位 | 开源 AI 编程代理 |
| 官网 | [opencode.ai](https://opencode.ai) / [github.com/anomalyco/opencode](https://github.com/anomalyco/opencode) |
| 许可证 | MIT |
| 当前版本 | v1.14.28 |
| 包管理器 | Bun 1.3+ |
| 技术特色 | TUI-first、模型无关、LSP 原生支持、客户端/服务器架构 |

**支持的产品形态**: CLI (TUI 终端) / Web GUI / 桌面应用 (Tauri + Electron) / Slack 机器人 / 企业多用户部署

---

## 二、技术架构

### 2.1 Monorepo 包结构

项目使用 Bun workspaces 管理 16+ 个包，分为四个层级：

**核心应用层**

| 包 | 说明 |
|----|------|
| opencode (CLI) | 主应用：CLI 命令、Agent 运行时、TUI、Hono 服务端、SQLite 存储 |
| @opencode-ai/app | Web GUI：SolidJS + Vite SPA |
| @opencode-ai/desktop | Tauri 桌面壳（Rust 后端） |
| @opencode-ai/desktop-electron | Electron 桌面壳 |

**共享库层**

| 包 | 说明 |
|----|------|
| @opencode-ai/core | 共享工具库：文件系统、Effect 运行时、日志 |
| @opencode-ai/ui | SolidJS UI 组件库：Markdown 渲染、Diff、CodeMirror、主题、i18n |
| @opencode-ai/sdk | TypeScript SDK v1 + v2 |
| @opencode-ai/plugin | 插件类型定义 |

**平台与集成层**

| 包 | 说明 |
|----|------|
| @opencode-ai/web | 文档/营销站（Astro + Starlight，17+ 语言） |
| @opencode-ai/slack | Slack 机器人 |
| @opencode-ai/enterprise | 企业多用户部署（SolidStart/Nitro） |
| console/* | 云控制台（账单、账户、模型目录） |

### 2.2 核心技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| 运行时 | Bun / TypeScript / Rust (Tauri) | Bun 1.3 / TS 5.8 |
| 前端 | SolidJS / Vite / TailwindCSS / CodeMirror / Shiki | SolidJS 1.9 / Vite 7 / Tailwind 4 |
| 后端 | Hono / Effect-TS / Drizzle ORM / SQLite | Hono 4 / Effect 4.0-beta / Drizzle beta |
| AI | Vercel AI SDK / @ai-sdk/* (多提供商) | ai 6.0 |
| 验证 | Zod | 4.1 |
| 基础设施 | SST 3 / Cloudflare / AWS S3 / PlanetScale | SST 3.18 |

### 2.3 包级依赖图

依赖关系形成严格分层 DAG，无循环依赖：

```
叶子节点: core / sdk / script / function  (零内部依赖)
    ↓
桥梁层: ui (依赖 core + sdk) → 被 app / desktop / enterprise 消费
    ↓
应用层: app → desktop / desktop-electron (双桌面方案)
    ↓
集成层: opencode CLI → plugin / script / sdk / core
```

---

## 三、核心设计

### 3.1 opencode 包内部模块层级

50+ 模块，严格五层结构：

```
Layer 0 (底层):   util/ — 零内部依赖，纯工具
Layer 1 (基础设施): bus / git / effect/
Layer 2 (核心服务): config / storage / provider
Layer 3 (领域模块): agent / session / lsp / mcp / plugin / permission / tool
Layer 4 (集成层):  effect/app-runtime.ts — 编排所有模块
Layer 5 (入口层):  cli / server
```

**枢纽模块 Top 3**:

- @/util (被 15+ 模块依赖) — 文件系统、Schema、Effect 封装
- @/session (被 15+ 模块依赖) — 最复杂业务模块
- @/bus (被 10+ 模块依赖) — 事件总线，模块间解耦核心

### 3.2 app 包 Context 系统

18 个 Context Provider，双层架构：

- **Tier 1** (6 个): server / settings / language / layout / platform / model-variant — 仅依赖 utils，无跨 context 依赖
- **Tier 2** (12 个): command / file / notification / permission / global-sync / sync / prompt 等 — 单向依赖 Tier 1

无循环依赖，形成干净的有向无环图。

### 3.3 关键 Effect-TS 模式

- **模块自导出**: `export * as Foo from "."` 替代 namespace，支持 tree-shaking
- **InstanceState**: 按目录隔离服务状态，自动清理，多项目并发安全
- **EffectBridge**: 跨模块通信桥接层，连接 provider/session/mcp/plugin
- **makeRuntime**: 统一 Runtime 构建，memoMap 去重 Layer 实例化
- **Bus 事件总线**: 模块间解耦通信核心机制

---

## 四、桌面端方案对比

### 4.1 Tauri v2 vs Electron 41

| 维度 | Tauri v2 | Electron 41 |
|------|----------|-------------|
| 架构 | 薄壳 + 外部 sidecar 进程 | 内置服务端，自包含 |
| 后端语言 | Rust | Node.js (TypeScript) |
| 包体 | ~10MB | ~150MB (含 Chromium) |
| 原生能力 | 通过 plugin 获得 | 完整 Node.js API |
| Shell 环境 | 无自动加载 | 自动加载用户 Shell env |
| 更新机制 | 基本支持 | 完整 auto-updater + 对话框 |
| IPC 能力 | 9 个 Tauri 命令 | 40+ IPC handler + 文件选择器 |
| 菜单系统 | 依赖 Web | 原生 macOS 菜单 |
| 适用场景 | 轻量快速启动 | 全功能桌面体验 |

### 4.2 当前状态

Electron 版功能显著多于 Tauri 版（+10 项实质性差异），Tauri 版目前是精简壳，需补齐：服务端嵌入、Shell 环境注入、IPC 扩展、菜单系统。

---

## 五、近期进展

### 5.1 Global Search Panel（设计已批准，2026-05-05）

- VS Code 风格全文搜索面板（Ctrl+Shift+F）
- 支持正则、大小写、全词匹配、文件过滤
- 结果按文件分组，F4/Shift-F4 导航
- 300ms debounce 自动搜索

### 5.2 Bun Shell 迁移（进行中）

- 143 处 `$` 模板调用 → 统一 Process API
- 热点文件：github.ts (33 处)、worktree (22)、lsp (21)、installation (20)
- 插件 `$` 兼容保留至 1.x，2.0 移除

### 5.3 Electron 性能优化（已完成 7 项）

| 优化项 | 效果 |
|--------|------|
| Shell env 缓存到 electron-store | 二次启动跳过 spawnSync（节省 0-5s） |
| contextMenu 延迟至 app.whenReady | 不阻塞模块加载 |
| Health check 轮询 100→250ms | 减少 60% CPU 唤醒 |
| Store Proxy 内存缓存 | 避免重复磁盘 IO |
| CORS 头仅对跨域请求注入 | 内部 oc:// 请求开销清零 |
| Store 批量 IPC | 减少 IPC 往返次数 |
| 启动 loading 状态预暴露 | 渲染端可提前展示 skeleton |

全部改动约 100 行，6 个文件，零架构变更，32 项验证测试通过。

---

## 六、文件依赖全景

详细报告见 [dependency-analysis-report.md](dependency-analysis-report.md)

### 6.1 关键数据

- 16 个包，零循环依赖
- opencode 包 50+ 模块，5 层结构
- app 包 18 个 Context Provider，双层 DAG
- 外部核心依赖：Effect 4.0 / SolidJS 1.9 / Hono 4 / Drizzle / AI SDK 6.0

### 6.2 核心发现

- session 模块是最重依赖点（15+ 内部依赖）
- git 模块是最纯净叶子节点（零内部 @/ 导入）
- app-runtime.ts 是集成枢纽（导入几乎所有模块）
- config 采用自导出模式（无 barrel 爆炸）

---

## 七、后续计划

| 方向 | 内容 |
|------|------|
| Bun Shell 迁移 | 完成剩余文件迁移，确保行为一致 |
| Global Search | 进入实现阶段：ripgrep 后端 + 前端面板 + 键盘导航 |
| Tauri 追赶 | 补齐 Shell 环境注入、丰富 IPC、菜单系统 |
| 性能持续优化 | 启动时间基线测量、渲染性能预算、内存泄漏检查 |
| 文档完善 | 依赖分析报告维护、架构决策记录 (ADR) |
