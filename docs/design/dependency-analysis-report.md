# OpenCode 文件依赖关系分析报告

**日期**: 2026-05-12

---

## 一、Monorepo 包级依赖图

OpenCode 使用 Bun workspaces 管理 16 个包，通过 `workspace:*` 声明内部依赖。以下是完整的包间依赖关系：

### 核心链路

```
                    ┌──────────────┐
                    │   opencode   │ (主 CLI)
                    │  (TUI/服务端) │
                    └──┬───┬───┬──┘
                       │   │   │
              ┌────────┘   │   └────────┐
              ▼            ▼            ▼
      ┌──────────┐  ┌──────────┐  ┌──────────┐
      │  plugin  │  │  script  │  │   sdk    │
      │ (插件类型)│  │ (构建脚本)│  │ (TS SDK) │
      └────┬─────┘  └──────────┘  └────┬─────┘
           │                           │
           ▼                           │
      ┌──────────┐                     │
      │   sdk    │                     │
      └──────────┘                     │
                                       │
           ┌───────────────────────────┘
           ▼                 ▼
    ┌──────────┐      ┌──────────┐
    │   core   │◄─────│    ui    │
    │ (工具库) │      │ (UI组件) │
    └──────────┘      └────┬─────┘
           ▲               │
           │      ┌────────┘
           │      ▼
    ┌──────┴──────────┐
    │      app        │ (Web GUI)
    └───┬──────┬──────┘
        │      │
   ┌────┘      └────┐
   ▼                ▼
┌────────┐   ┌───────────────┐
│desktop │   │desktop-electron│
│(Tauri) │   │  (Electron)    │
└────────┘   └───────────────┘
```

### 完整依赖矩阵

| 包名 | 依赖的 workspace 包 |
|------|-------------------|
| `opencode` | plugin, script, sdk, core(dev) |
| `@opencode-ai/app` | sdk, ui, core |
| `@opencode-ai/ui` | sdk, core |
| `@opencode-ai/plugin` | sdk |
| `@opencode-ai/desktop` | app, ui |
| `@opencode-ai/desktop-electron` | app(dev), ui(dev) |
| `@opencode-ai/enterprise` | core, ui |
| `@opencode-ai/slack` | sdk |
| `@opencode-ai/web` | opencode(dev) |
| `@opencode-ai/console-app` | console-core, console-mail, console-resource, ui |
| `@opencode-ai/console-core` | console-mail, console-resource |
| `@opencode-ai/console-function` | console-core, console-resource |
| `@opencode-ai/core` | **无** (叶子节点) |
| `@opencode-ai/sdk` | **无** (叶子节点) |
| `@opencode-ai/script` | **无** (叶子节点) |
| `@opencode-ai/function` | **无** (叶子节点) |

**关键发现**: `core` 和 `sdk` 是零内部依赖的叶子节点，是整个依赖图的基石。`ui` 是连接 `core`/`sdk` 到 `app`/`desktop`/`enterprise` 的桥梁。

---

## 二、packages/opencode 内部模块依赖

### 依赖层级

```
Layer 0 (最底层): util/ — 无内部 @/ 导入，纯粹的叶子模块
Layer 1 (基础设施): bus, git, id, effect/
Layer 2 (核心服务): config/, storage/, provider/
Layer 3 (领域模块): agent/, session/, lsp/, mcp/, plugin/, permission/, tool/, file/, shell/
Layer 4 (集成层): effect/app-runtime.ts — 编排所有模块
Layer 5 (入口层): cli/, server/
```

### 枢纽模块（被引用最多的模块）

| 模块 | 被引用次数 | 角色 |
|------|-----------|------|
| `@/util/*` | ~15+ | 底层工具集：文件系统、Schema、Effect 封装、进程执行、编码 |
| `@/bus` | ~10+ | 内部事件总线，所有领域模块通信的基础 |
| `@/effect/*` | ~12+ | Effect 运行时封装：InstanceState、EffectBridge、AppRuntime |
| `@/config/config` | ~10+ | 全局配置，几乎所有模块都依赖 |
| `@/provider/provider` | ~7+ | AI 提供商适配层 |
| `@/session` | ~15+ | 最复杂的模块，依赖 15+ 个内部模块 |

### 关键模块依赖详情

**session/** (最重依赖): 依赖 bus, config, provider, agent, plugin, permission, snapshot, storage, lsp, tool, util, effect, auth, installation, question, id, skill, shell, sync — 几乎覆盖了整个系统的所有核心模块。

**effect/app-runtime.ts** (集成枢纽): 导入 bus, auth, account, config, git, file, storage, snapshot, plugin, provider, agent, skill, question, permission, session, lsp, mcp, command, tool, format, project, worktree, pty, installation, share, control-plane — 集成所有模块构建完整运行时。

**git/** (最纯净的叶子模块): 零内部 `@/` 导入，仅依赖外部 git 命令和 util 工具。

---

## 三、packages/app 内部模块依赖

### 依赖层级

```
Layer 0: utils/ (persist, base64, same, id, diffs, prompt, sound, worktree...)
Layer 1: hooks/ (use-providers)
Layer 2: context/ Tier 1 (server, settings, language, layout, platform, model-variant)
Layer 3: context/ Tier 2 (command, file, notification, highlights, permission, models, 
                          local, global-sync, sync, terminal, prompt, comments, editor)
Layer 4: components/ (titlebar, editor-panel, file-tree-panel, session/*)
Layer 5: pages/ (app.tsx → layout.tsx → session.tsx)
```

### context/ 双层架构

**Tier 1 (纯工具消费者，无跨 context 依赖)**:
- `server` — 仅依赖 utils/persist
- `settings` — 仅依赖 utils/persist
- `language` — 仅依赖 utils/persist
- `layout` — 仅依赖 utils/*
- `platform` — 无内部依赖
- `model-variant` — 无内部依赖

**Tier 2 (跨 context 依赖)**:
- `command` → language, settings
- `file` → language, layout
- `notification` → platform, language, settings
- `permission` → global-sdk
- `models`, `local` → hooks/use-providers
- `prompt`, `comments` → file
- `global-sync` → language, utils

所有依赖形成**有向无环图 (DAG)**，无循环依赖。

---

## 四、外部依赖分类

### 按类别统计

| 类别 | 关键库 | 使用包 |
|------|--------|--------|
| **运行时 & 构建** | bun, typescript, vite, turbo | 全项目 |
| **前端 UI** | solid-js, @kobalte/core, tailwindcss, shiki, codemirror, marked | app, ui, web, enterprise, console |
| **TUI** | @opentui/core, @opentui/solid | opencode (CLI) |
| **后端/服务端** | hono, effect | opencode, enterprise, function, console-function |
| **FP 运行时** | effect 4.0-beta | opencode, core, plugin, ui, app, enterprise |
| **AI/LLM** | ai (Vercel AI SDK 6.0), @ai-sdk/* (anthropic, openai, google, xai, deepseek...) | opencode, web, enterprise, console-function |
| **数据库** | drizzle-orm, @planetscale/database, postgres | opencode, enterprise, console-core |
| **数据验证** | zod 4 | opencode, core, plugin, enterprise, console |
| **基础设施** | sst 3, @aws-sdk/*, @cloudflare/workers-types | 根项目, function, console |
| **桌面** | @tauri-apps/* (v2), electron | desktop, desktop-electron |
| **桌面 Shell** | @lydell/node-pty | opencode, desktop-electron |
| **认证** | @openauthjs/openauth, jose | opencode, function |
| **Git** | @octokit/rest | opencode, function, enterprise |
| **工具库** | cross-spawn, luxon, diff, semver, remeda, marked, turndown | 跨多个包 |

### 关键版本速查

| 包 | 版本 |
|----|------|
| typescript | 5.8.2 |
| solid-js | 1.9.10 |
| effect | 4.0.0-beta.57 |
| hono | 4.10.7 |
| ai | 6.0.168 |
| drizzle-orm | 1.0.0-beta.19 |
| zod | 4.1.8 |
| vite | 7.1.4 |
| tailwindcss | 4.1.11 |
| shiki | 3.20.0 |

---

## 五、架构特征总结

1. **分层清晰**: 依赖图呈现严格的分层结构，从底层 util → 基础设施 → 领域模块 → 集成层 → 入口层，无跨层反向依赖。

2. **无循环依赖**: 包级和模块级均形成 DAG，context 层的双层设计保证了干净的单向数据流。

3. **Effect 是骨架**: Effect-TS 4.0-beta 贯穿整个系统，`InstanceState` 和 `EffectBridge` 是所有模块共享的基础设施。

4. **Bus 是神经系统**: `@/bus` 内部事件总线被几乎所有模块依赖，是模块间解耦通信的核心机制。

5. **config 是中央配置**: 所有模块依赖 `config/config` 获取运行时配置，采用自导出模式组织配置子模块。

6. **session 是复杂度聚集点**: session 模块依赖 15+ 个内部模块，是整个系统最复杂的业务逻辑所在。

7. **app 的 context 设计精良**: 18 个 context provider 分为两个层级，低层无跨依赖，高层单向依赖低层，保证了 Reactivity 的可预测性。
