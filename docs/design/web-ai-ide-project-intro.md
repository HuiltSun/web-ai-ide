# Web AI IDE — 项目技术文档

**日期**: 2026-05-12

---

## 一、产品概述

Web AI IDE 是一个基于浏览器的 AI 辅助编程环境，用户通过 Web 界面与 AI Agent 对话完成代码编写、文件管理、Git 操作、终端命令等开发任务。产品涵盖 Web 端、桌面端（Electron/Tauri）和企业多用户部署方案。

核心体验：左侧文件树 + 编辑器 + 中间 AI 会话面板 + 右侧 Review 面板 + 底部终端，形成完整的 IDE 布局。

---

## 二、技术架构

### 2.1 整体架构

```
┌──────────────────────────────────────────────────┐
│                   客户端层                         │
│  ┌────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │  Web GUI   │  │  Desktop     │  │  Desktop  │ │
│  │ (浏览器)    │  │  (Tauri)     │  │ (Electron)│ │
│  └─────┬──────┘  └──────┬───────┘  └─────┬─────┘ │
│        │                │                │        │
│        └────────────────┼────────────────┘        │
│                         │                         │
│                  ┌──────┴──────┐                  │
│                  │   SDK 层    │                  │
│                  └──────┬──────┘                  │
├─────────────────────────┼─────────────────────────┤
│                         │          服务端层         │
│  ┌──────────────────────┴─────────────────────┐   │
│  │            Hono HTTP Server                │   │
│  ├──────────┬──────────┬──────────┬──────────┤   │
│  │ Agent    │ Config   │ Storage  │ Auth     │   │
│  │ Runtime  │ Manager  │ (SQLite) │ (OAuth)  │   │
│  └──────────┴──────────┴──────────┴──────────┘   │
└──────────────────────────────────────────────────┘
```

客户端/服务器分离架构：服务端在本地运行（或远程），提供 REST API；客户端通过 SDK 连接服务端，渲染 Web UI。

### 2.2 核心技术栈

| 层 | 技术 | 用途 |
|----|------|------|
| 前端框架 | SolidJS 1.9 + Vite 7 | 响应式 UI，组件化 |
| 样式 | TailwindCSS 4 + @kobalte/core | 原子化 CSS + 无样式 UI 原语 |
| 编辑器 | CodeMirror | 代码编辑、Diff 查看、语法高亮 |
| 渲染 | Shiki / marked | Markdown 渲染、代码块语法高亮 |
| 后端 | Hono 4 (HTTP) + Effect 4.0-beta (FP) | API 路由 + 类型安全运行时 |
| 存储 | Drizzle ORM + SQLite | 会话、消息、配置持久化 |
| AI | Vercel AI SDK 6.0 + 多提供商 | Anthropic / OpenAI / Google 等统一接口 |
| 验证 | Zod 4 | 请求/响应 Schema 验证 |
| 构建 | Bun 1.3 + Turbo | 包管理、构建编排 |
| 桌面 | Electron 41 / Tauri v2 | 原生桌面封装 |

### 2.3 包依赖关系

项目采用 Monorepo 架构，Bun workspaces 管理，核心包依赖形成严格 DAG：

```
                   ┌─────────────┐
                   │   CLI/服务端  │
                   └──┬───┬───┬──┘
                      │   │   │
           ┌──────────┘   │   └──────────┐
           ▼              ▼              ▼
     ┌──────────┐   ┌──────────┐   ┌──────────┐
     │  plugin  │   │  script  │   │   sdk    │ ← 叶子节点
     └────┬─────┘   └──────────┘   └────┬─────┘
          │                             │
          └──────────┬──────────────────┘
                     ▼            ▼
              ┌──────────┐  ┌──────────┐
              │   core   │◄─│    ui    │ ← 桥梁层
              └──────────┘  └────┬─────┘
                     ▲           │
                     │    ┌──────┘
                     │    ▼
              ┌──────┴──────────┐
              │      app        │ ← Web GUI
              └───┬──────┬──────┘
                  │      │
             ┌────┘      └────┐
             ▼                ▼
       ┌──────────┐   ┌──────────────┐
       │ desktop  │   │desktop-electron│ ← 桌面壳
       │ (Tauri)  │   │  (Electron)   │
       └──────────┘   └──────────────┘
```

**关键特征**: 叶子节点 core / sdk 零内部依赖；ui 是连接底层与应用的桥梁；无循环依赖。

---

## 三、前端架构

### 3.1 Web GUI 模块结构

```
packages/app/src/
├── app.tsx                 # 入口：Provider 嵌套 + 路由
├── pages/
│   ├── layout.tsx          # 全局布局：标题栏 + 侧边栏 + 主内容区
│   ├── session.tsx         # 会话页：消息时间线 + 编辑器 + Review + 终端
│   └── session/
│       ├── message-timeline/  # 消息渲染列表
│       ├── composer/          # 输入框与提交
│       ├── review-tab/        # 代码变更审查
│       ├── session-side-panel/ # 右侧面板（Review + 文件树）
│       ├── terminal-panel/    # 底部终端
│       └── helpers/           # Tab 管理、文件操作
├── context/
│   ├── layout.tsx          # 布局状态：侧栏宽度、面板显隐、Session 宽度
│   ├── file.tsx            # 文件操作状态
│   ├── sync.tsx            # 会话/消息数据同步
│   ├── prompt.tsx          # 输入提示管理
│   ├── terminal.tsx        # 终端管理
│   ├── editor.tsx          # IDE 编辑器状态
│   └── ... (18 个 Provider)
├── components/
│   ├── file-tree-panel/    # 文件树面板（可拖拽调整宽度）
│   ├── editor-panel/       # 编辑器面板
│   ├── session/            # 会话相关组件
│   └── titlebar/           # 标题栏
└── utils/                  # 工具函数
```

### 3.2 Context Provider 双层架构

所有 Provider 形成有向无环图，无循环依赖：

- **Tier 1** (6 个): server / settings / language / layout / platform / model-variant — 仅依赖 utils 层
- **Tier 2** (12 个): command / file / notification / permission / sync / prompt / terminal / editor 等 — 单向依赖 Tier 1

### 3.3 IDE 布局可调整面板

布局支持四种可拖拽调整的区域：

| 面板 | 组件 | 默认宽度/高度 | 调整方式 |
|------|------|-------------|---------|
| 侧边栏 | layout.tsx | 344px | ResizeHandle 水平拖拽 |
| 文件树 | FileTreePanel | 200px | 内置 ResizeHandle |
| 会话面板 | session.tsx | 600px | ResizeHandle（侧面板打开时） |
| 终端 | TerminalPanel | 280px | ResizeHandle 垂直拖拽 |

---

## 四、Agent 系统

### 4.1 Agent 类型

| Agent | 权限 | 用途 |
|-------|------|------|
| build | 完整文件访问 | 默认开发 Agent，执行代码操作 |
| plan | 只读 | 代码分析和探索，执行命令前需确认 |
| general | 内部子 Agent | 复杂搜索和多步骤任务（@general 调用） |

### 4.2 Agent 运行时结构

```
packages/opencode/src/agent/    # Agent 核心逻辑
packages/opencode/src/provider/ # AI 提供商适配层
packages/opencode/src/tool/     # 工具注册与执行
packages/opencode/src/session/  # 会话管理（消息流、Diff、历史）
packages/opencode/src/permission/ # 权限控制
packages/opencode/src/lsp/      # LSP 语言服务器集成
```

---

## 五、桌面端

### 5.1 双方案对比

| 维度 | Tauri v2 | Electron 41 |
|------|----------|-------------|
| 架构 | 薄壳 + 外部 sidecar | 内置服务端，自包含 |
| 后端 | Rust | Node.js |
| 包体 | ~10MB | ~150MB |
| 适用 | 快速轻量启动 | 全功能桌面体验 |
| 原生菜单 | 无 | 完整 macOS 菜单 |
| Shell 环境 | 不加载 | 自动加载用户 env |
| 更新 | 基础支持 | auto-updater + 对话框 |

### 5.2 Electron 性能优化（已完成）

| 优化 | 效果 |
|------|------|
| Shell 环境缓存 | 二次启动跳过同步探测 |
| Store 内存缓存 | 避免重复磁盘 IO |
| Health check 间隔调整 | 减少 CPU 唤醒 |
| CORS 过滤 | 内部请求零开销 |
| IPC 批处理 | 减少往返次数 |

---

## 六、关键数据

| 指标 | 数据 |
|------|------|
| 总包数 | 16+ |
| 核心源码模块 | 50+ (opencode/src/) |
| Context Provider | 18 个 (双层 DAG) |
| 可拖拽面板 | 4 个 |
| Agent 类型 | 3 个 (build/plan/general) |
| 外部依赖 | 50+ (Effect/SolidJS/Hono/Drizzle/AI SDK) |
| 桌面方案 | 2 套 (Tauri + Electron) |
| 产品形态 | 5 种 (CLI/Web/Desktop/Slack/Enterprise) |
