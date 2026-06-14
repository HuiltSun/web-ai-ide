import pptxgen from "pptxgenjs"

const pptx = new pptxgen()
pptx.layout = "LAYOUT_WIDE"
pptx.author = "OpenCode Team"
pptx.title = "OpenCode 项目汇报"

// Color palette: Midnight Executive
const C = {
  navy: "1E2761",
  ice: "CADCFC",
  white: "FFFFFF",
  deep: "111932",
  mid: "2A3A6E",
  accent: "4A7AFF",
  lightBg: "F0F3FA",
}

// === Slide 1: Title ===
{
  const s = pptx.addSlide()
  s.background = { color: C.navy }
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: "100%", fill: { color: C.deep }, opacity: 0.3 })
  s.addText("OpenCode", { x: 0.8, y: 1.2, w: 8, h: 1.2, fontSize: 48, bold: true, color: C.white, fontFace: "Inter" })
  s.addText("开源 AI 编程代理 — 项目汇报", { x: 0.8, y: 2.5, w: 8, h: 0.8, fontSize: 22, color: C.ice, fontFace: "Inter" })
  s.addText("技术团队内部汇报  |  2026年5月", { x: 0.8, y: 3.6, w: 8, h: 0.5, fontSize: 14, color: "A0B4D0", fontFace: "Inter" })
}

// === Slide 2: Agenda ===
{
  const s = pptx.addSlide()
  s.background = { color: C.white }
  s.addText("汇报大纲", { x: 0.8, y: 0.5, w: 8, h: 0.8, fontSize: 32, bold: true, color: C.navy, fontFace: "Inter" })
  const items = [
    "1. 项目概览 — 定位、规模、里程碑",
    "2. 技术架构 — Monorepo 结构、技术栈、包依赖图",
    "3. 核心设计 — Effect 模式、模块层级、Context 系统",
    "4. 桌面端方案 — Tauri vs Electron 对比与选型",
    "5. 近期进展 — Global Search、Bun Shell 迁移、性能优化",
    "6. 文件依赖全景 — 包级与模块级依赖分析",
    "7. 后续计划"
  ]
  items.forEach((item, i) => {
    s.addText(item, { x: 1.0, y: 1.6 + i * 0.55, w: 8, h: 0.45, fontSize: 14, color: C.navy, fontFace: "Inter", bullet: false })
  })
}

// === Slide 3: Project Overview ===
{
  const s = pptx.addSlide()
  s.background = { color: C.navy }
  s.addText("项目概览", { x: 0.8, y: 0.5, w: 8, h: 0.8, fontSize: 32, bold: true, color: C.white, fontFace: "Inter" })

  const left = [
    { label: "定位", value: "开源的 AI 编程代理 (AI Coding Agent)" },
    { label: "官网", value: "opencode.ai / github.com/anomalyco/opencode" },
    { label: "许可证", value: "MIT" },
    { label: "当前版本", value: "v1.14.28" },
    { label: "技术特色", value: "TUI-first、模型无关、LSP 原生、C/S 架构" },
  ]
  left.forEach((row, i) => {
    s.addText(row.label, { x: 0.8, y: 1.6 + i * 0.55, w: 1.8, h: 0.4, fontSize: 13, bold: true, color: C.ice, fontFace: "Inter" })
    s.addText(row.value, { x: 2.8, y: 1.6 + i * 0.55, w: 5, h: 0.4, fontSize: 13, color: C.white, fontFace: "Inter" })
  })
}

// === Slide 4: Tech Architecture ===
{
  const s = pptx.addSlide()
  s.background = { color: C.white }
  s.addText("技术架构 — Monorepo 全景", { x: 0.8, y: 0.5, w: 9, h: 0.8, fontSize: 28, bold: true, color: C.navy, fontFace: "Inter" })

  const data = [
    ["层级", "包名", "说明"],
    ["核心", "opencode (CLI)", "TUI / Agent / 服务端 / 存储"],
    ["Web", "@opencode-ai/app", "SolidJS Web GUI"],
    ["UI 库", "@opencode-ai/ui", "共享组件 (Markdown/Diff/主题)"],
    ["工具", "@opencode-ai/core", "文件系统 / Effect 运行时 / 日志"],
    ["SDK", "@opencode-ai/sdk", "TypeScript SDK v1 + v2"],
    ["插件", "@opencode-ai/plugin", "插件类型定义"],
    ["桌面", "desktop / desktop-electron", "Tauri + Electron 双方案"],
    ["企业", "@opencode-ai/enterprise", "多用户部署"],
    ["集成", "@opencode-ai/slack", "Slack 机器人"],
  ]
  data.forEach((row, ri) => {
    row.forEach((cell, ci) => {
      const isHeader = ri === 0
      s.addText(cell, {
        x: 0.5 + ci * 3.1, y: 1.4 + ri * 0.38, w: 2.9, h: 0.35,
        fontSize: isHeader ? 12 : 11, bold: isHeader,
        color: isHeader ? C.accent : C.navy, fontFace: "Inter"
      })
    })
  })
}

// === Slide 5: Dependency Graph ===
{
  const s = pptx.addSlide()
  s.background = { color: C.navy }
  s.addText("包级依赖关系", { x: 0.8, y: 0.5, w: 9, h: 0.8, fontSize: 28, bold: true, color: C.white, fontFace: "Inter" })

  const key = [
    "叶子节点 (零内部依赖): core / sdk / script / function",
    "桥梁层: ui (依赖 core + sdk，被 app/desktop/enterprise 消费)",
    "应用层: app → desktop/desktop-electron (Tauri/Electron)",
    "集成层: opencode CLI 依赖 plugin / script / sdk",
    "特征: 严格分层 DAG，无循环依赖"
  ]
  key.forEach((item, i) => {
    s.addText(item, { x: 0.8, y: 1.6 + i * 0.5, w: 9, h: 0.4, fontSize: 13, color: C.ice, fontFace: "Inter", bullet: true })
  })
}

// === Slide 6: Core Design — Effect Patterns ===
{
  const s = pptx.addSlide()
  s.background = { color: C.white }
  s.addText("核心设计 — Effect-TS 模式", { x: 0.8, y: 0.5, w: 9, h: 0.8, fontSize: 28, bold: true, color: C.navy, fontFace: "Inter" })

  const patterns = [
    { name: "模块自导出", desc: "export * as Foo from \".\" 替代 export namespace，支持 tree-shaking" },
    { name: "InstanceState", desc: "按目录隔离的服务状态，自动清理，用于多项目并发" },
    { name: "EffectBridge", desc: "跨模块通信桥接层，连接 provider/session/mcp/plugin" },
    { name: "makeRuntime", desc: "统一 Runtime 构建，memoMap 去重 Layer 实例化" },
    { name: "Bus 事件总线", desc: "模块间解耦通信的核心，被 10+ 模块依赖" },
    { name: "Config 自导出", desc: "配置模块采用扁平文件 + 自导出，避免 barrel 爆炸" },
  ]
  patterns.forEach((p, i) => {
    s.addText(p.name, { x: 0.8, y: 1.6 + i * 0.7, w: 3, h: 0.3, fontSize: 13, bold: true, color: C.accent, fontFace: "Inter" })
    s.addText(p.desc, { x: 0.8, y: 1.95 + i * 0.7, w: 8, h: 0.35, fontSize: 12, color: "555555", fontFace: "Inter" })
  })
}

// === Slide 7: Desktop Comparison ===
{
  const s = pptx.addSlide()
  s.background = { color: C.navy }
  s.addText("桌面端方案对比", { x: 0.8, y: 0.5, w: 9, h: 0.8, fontSize: 28, bold: true, color: C.white, fontFace: "Inter" })

  const rows = [
    ["维度", "Tauri v2", "Electron 41"],
    ["架构", "薄壳 + 外部 sidecar", "内置服务端，自包含"],
    ["后端语言", "Rust", "Node.js (TypeScript)"],
    ["包体大小", "小 (~10MB)", "大 (~150MB+Chromium)"],
    ["原生能力", "通过 plugin 获得", "完整 Node.js + 原生菜单"],
    ["Shell 环境", "无", "自动加载用户 Shell env"],
    ["更新机制", "基本更新支持", "完整 auto-updater + 对话框"],
    ["IPC 能力", "9 个 Tauri 命令", "40+ IPC handler + 文件选择器"],
    ["适用场景", "轻量快速启动", "全功能桌面体验"],
  ]
  rows.forEach((row, ri) => {
    row.forEach((cell, ci) => {
      const isHeader = ri === 0
      s.addText(cell, {
        x: 0.5 + ci * 4.5, y: 1.4 + ri * 0.45, w: 4.3, h: 0.4,
        fontSize: isHeader ? 13 : 11, bold: isHeader,
        color: isHeader ? C.accent : (ci === 2 ? C.white : C.ice), fontFace: "Inter"
      })
    })
  })
}

// === Slide 8: Recent Work ===
{
  const s = pptx.addSlide()
  s.background = { color: C.white }
  s.addText("近期进展", { x: 0.8, y: 0.5, w: 9, h: 0.8, fontSize: 28, bold: true, color: C.navy, fontFace: "Inter" })

  const work = [
    { title: "Global Search Panel", status: "设计已批准 (2026-05-05)", desc: "VS Code 风格全文搜索，支持正则/大小写/文件过滤，F4 导航" },
    { title: "Bun Shell 迁移", status: "进行中", desc: "143 处 $ 调用 → Process API，热点: github.ts(33), worktree(22), lsp(21)" },
    { title: "性能优化 (Electron)", status: "已完成 7 项", desc: "Shell env 缓存、Store 内存缓存、IPC 批处理、CORS 过滤、启动加速" },
  ]
  work.forEach((w, i) => {
    const y = 1.6 + i * 1.15
    s.addShape(pptx.ShapeType.rect, { x: 0.7, y: y, w: 0.08, h: 0.95, fill: { color: C.accent } })
    s.addText(w.title, { x: 1.1, y: y, w: 3, h: 0.35, fontSize: 15, bold: true, color: C.navy, fontFace: "Inter" })
    s.addText(w.status, { x: 4.5, y: y, w: 5, h: 0.35, fontSize: 12, color: C.accent, fontFace: "Inter" })
    s.addText(w.desc, { x: 1.1, y: y + 0.4, w: 8, h: 0.5, fontSize: 12, color: "555555", fontFace: "Inter" })
  })
}

// === Slide 9: Dependency Analysis ===
{
  const s = pptx.addSlide()
  s.background = { color: C.navy }
  s.addText("文件依赖全景分析", { x: 0.8, y: 0.5, w: 9, h: 0.8, fontSize: 28, bold: true, color: C.white, fontFace: "Inter" })

  const findings = [
    "opencode 包 50+ 模块，五层结构: util → 基础设施 → 服务 → 领域 → 入口",
    "枢纽模块 Top 3: @/util (15+)、@/session (15+)、@/bus (10+)",
    "app 包 18 个 Context Provider，双层 DAG，无循环依赖",
    "外部依赖 50+，核心技术栈: Effect 4.0 / SolidJS 1.9 / Hono 4 / Drizzle / AI SDK 6.0",
    "完整依赖分析报告: docs/design/dependency-analysis-report.md",
  ]
  findings.forEach((item, i) => {
    s.addText(item, { x: 0.8, y: 1.6 + i * 0.6, w: 9, h: 0.5, fontSize: 13, color: C.ice, fontFace: "Inter", bullet: true })
  })
}

// === Slide 10: Next Steps ===
{
  const s = pptx.addSlide()
  s.background = { color: C.white }
  s.addText("后续计划", { x: 0.8, y: 0.5, w: 9, h: 0.8, fontSize: 28, bold: true, color: C.navy, fontFace: "Inter" })

  const plans = [
    { area: "Bun Shell 迁移", detail: "完成剩余文件的 Process API 迁移，插件 $ 兼容保留至 1.x" },
    { area: "Global Search", detail: "进入实现阶段: rg 后端 + 前端搜索面板 + 键盘导航" },
    { area: "Tauri 追赶", detail: "补齐 Electron 版的 Shell 环境注入、丰富 IPC、菜单系统" },
    { area: "性能持续优化", detail: "启动时间基线测量、渲染性能预算、内存泄漏检查" },
    { area: "文档完善", detail: "依赖分析报告维护、架构决策记录 (ADR)" },
  ]
  plans.forEach((p, i) => {
    const y = 1.6 + i * 0.75
    s.addShape(pptx.ShapeType.rect, { x: 0.7, y: y + 0.05, w: 0.08, h: 0.45, fill: { color: C.accent } })
    s.addText(p.area, { x: 1.1, y: y, w: 3, h: 0.3, fontSize: 14, bold: true, color: C.navy, fontFace: "Inter" })
    s.addText(p.detail, { x: 1.1, y: y + 0.33, w: 8, h: 0.35, fontSize: 12, color: "555555", fontFace: "Inter" })
  })
}

// === Slide 11: Thanks ===
{
  const s = pptx.addSlide()
  s.background = { color: C.navy }
  s.addText("谢谢", { x: 0.8, y: 2.0, w: 8, h: 1.2, fontSize: 48, bold: true, color: C.white, fontFace: "Inter" })
  s.addText("github.com/anomalyco/opencode  |  opencode.ai", { x: 0.8, y: 3.2, w: 8, h: 0.5, fontSize: 14, color: C.ice, fontFace: "Inter" })
}

// Save
const outPath = "/sessions/affectionate-friendly-faraday/mnt/opencode/docs/design/opencode-project-report.pptx"
await pptx.writeFile({ fileName: outPath })
console.log("PPT saved to docs/design/opencode-project-report.pptx")
