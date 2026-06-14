---
title: Documentation
description: Web AI IDE complete documentation.
---

**Web AI IDE** documentation is served by Astro Starlight — the same engine that powers [opencode.ai/docs](https://opencode.ai/docs).

## Quick Start

```bash
bun run --cwd packages/web dev
# → http://localhost:4321/docs
```

## Pages

| Section | Pages |
|---------|-------|
| Intro | Getting started, prerequisites, install, configure, initialize, usage |
| **Usage** | Go, TUI, CLI, Web, IDE, Zen, Share, GitHub, GitLab |
| **Configure** | Tools, Rules, Agents, Models, Themes, Keybinds, Commands, Formatters, Permissions, LSP, MCP, ACP, Skills, Custom Tools |
| **Develop** | SDK, Server, Plugins, Ecosystem |

All pages support: sidebar navigation, search, light/dark mode, code syntax highlighting, and 17 language translations.

## Source Files

The documentation source is in `packages/web/src/content/docs/` — MDX files with Astro Starlight components.
