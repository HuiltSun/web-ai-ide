# Global Search Panel — Design Spec

**Date**: 2026-05-05
**Status**: Approved
**Scope**: Add a VS Code-style persistent search panel to the OpenCode web app

---

## Overview

Add a global search panel to the left sidebar that provides full-text code search across the workspace, matching VS Code's Search (Ctrl+Shift+F) experience. The existing Ctrl+P quick-open palette remains unchanged.

### Goals

- Persistent search results panel in the left sidebar
- Results grouped by file, with expandable match lists and per-file match counts
- Regex, case sensitivity, and whole-word toggles
- File include/exclude pattern filters
- Click result → open file at line, panel stays open
- Keyboard navigation: F4/Shift-F4 for next/previous match
- 300ms debounced auto-search

### Non-Goals (this iteration)

- Replace-in-files functionality
- Search across multiple workspaces
- LSP symbol search integration (separate future feature)
- File name search integration (Ctrl+P handles that)
- Search history persistence

---

## Architecture

### Dual Entry System

```
Ctrl+P (unchanged)          Ctrl+Shift+F (new)
┌──────────────┐            ┌──────────────────────────────┐
│ Quick Open   │            │ Search Panel (sidebar)       │
│ Commands     │            │ ┌──────────────────────────┐ │
│ Files        │            │ │ Search: [pattern  ] [Aa] │ │
│ Sessions     │            │ │ Replace: [         ] [.*] │ │
│              │            │ │ files: *.ts   3 files     │ │
│ (no changes) │            │ ├──────────────────────────┤ │
└──────────────┘            │ │ ▼ src/grep.ts  3 matches │ │
                            │ │   42: const grep = ...   │ │
                            │ │ ▼ src/ripgrep.ts 2       │ │
                            │ │   137: const search =    │ │
                            │ └──────────────────────────┘ │
                            └──────────────────────────────┘
```

### Component Tree

```
SidebarShell (existing, modified)
└── TabRouter (new)
    ├── Tab "files" → SessionList (existing, unchanged)
    └── Tab "search" → SearchPanel (new)
                        ├── SearchInput
                        │   ├── TextField (pattern)
                        │   ├── TextField (replace, collapsed by default)
                        │   └── SearchToggleBar
                        │       ├── Toggle [Aa] case sensitive
                        │       ├── Toggle [.*] regex
                        │       └── Toggle [ab] whole word
                        ├── SearchFilterBar
                        │   ├── TextField (include pattern)
                        │   └── TextField (exclude pattern)
                        └── SearchResultsTree
                            └── SearchFileGroup (per file)
                                ├── FileHeader (collapsible, shows match count)
                                └── SearchResultItem[] (per match line)
```

### Data Flow

```
SearchInput (300ms debounce)
  → sdk.client.find.text({ pattern, include, exclude, caseSensitive, wholeWord, limit })
    → GET /find?pattern=...&limit=200&include=...
      → Ripgrep.Service.search() — rg --json
        → SearchMatch[] (relative paths, relative to project root)
  ← SearchResultsTree grouped by filepath
```

---

## Remote Server Compatibility

The OpenCode architecture uses a client/server model where the web app (client) connects to
an opencode server (local or remote) via the SDK. The search panel works correctly in both
scenarios because of how paths flow through the system:

### How It Works

1. Ripgrep runs **on the server's filesystem**, returning paths relative to the project
   root (e.g., `"src/tool/grep.ts"`)
2. The HTTP API returns these relative paths directly — no absolute server paths are
   exposed
3. When the user clicks a result to open a file, the web app calls
   `sdk.client.file.read({ path: "src/tool/grep.ts" })` — a relative path
4. The server resolves this relative path against its project directory and returns
   the file content as text
5. The web app renders the content in the editor tab

### Why No Path Translation Is Needed

```
Remote client (browser)              Remote server (opencode)
┌────────────────────────┐           ┌──────────────────────────┐
│ User searches "grep"   │── SDK ──→│ rg search → relative paths│
│ Results:               │←─ JSON ──│ ["src/tool/grep.ts:42",  │
│  src/tool/grep.ts:42   │           │  "src/file/index.ts:89"] │
│                         │           │                          │
│ User clicks result     │── SDK ──→│ path.join(projectDir,    │
│ file.open("src/tool/   │           │   "src/tool/grep.ts")    │
│   grep.ts", line: 42)  │←─ text ──│ → read file → content    │
│ Editor shows file      │           │                          │
└────────────────────────┘           └──────────────────────────┘
```

The SDK client already sends `x-opencode-directory` as a header, which the server uses to
identify the correct project instance. This ensures the server resolves relative paths
against the right project root.

### What Needs No Change

- File reading (`file.read`), directory listing (`file.list`), and file name search
  (`find.files`) all work via relative paths — no changes needed
- No path translation layer required between client and server
- No special "remote mode" handling needed

### Existing Hardcoded Limit

The current `/find` endpoint has a hardcoded `limit: 10` in the `findText` handler
at `file.ts` line 124-128. This must be changed to accept a configurable limit for the
search panel to display a useful number of results.

---

## Backend Changes

### `GET /find` — Parameter Additions

Add four new optional query parameters to the existing endpoint at
`packages/opencode/src/server/routes/instance/httpapi/file.ts`, and make the existing
limit configurable:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 200 | Max results to return (was hardcoded to `10`) |
| `exclude` | string | — | Exclude glob pattern (passed as `!` glob to ripgrep) |
| `caseSensitive` | boolean | false | If true, do NOT pass `-i` to ripgrep |
| `wholeWord` | boolean | false | Pass `-w` to ripgrep |

**Code change in `file.ts`** (current → new):

```typescript
// Current (hardcoded limit: 10)
const findText = Effect.fn("FileHttpApi.findText")(function* (ctx) {
  return (yield* ripgrep
    .search({ cwd: ..., pattern: ctx.query.pattern, limit: 10 })
    .pipe(Effect.orDie)).items
})

// New (configurable limit, plus new params)
const findText = Effect.fn("FileHttpApi.findText")(function* (ctx) {
  return (yield* ripgrep
    .search({
      cwd: ...,
      pattern: ctx.query.pattern,
      limit: ctx.query.limit ?? 200,
      glob: ctx.query.include ? [ctx.query.include] : undefined,
      // exclude, caseSensitive, wholeWord passed through to ripgrep args
    })
    .pipe(Effect.orDie)).items
})
```

The `Ripgrep.Service.search()` function already supports `glob` for include patterns. The
`caseSensitive` toggle maps to omitting the `-i` flag. The `wholeWord` toggle maps to adding `-w`.
The `exclude` parameter maps to adding `--glob=!<pattern>`.

The existing response format (`SearchMatch[]`) is unchanged.

### Response Type (unchanged)

```typescript
SearchMatch = {
  file: string          // relative file path (relative to project root)
  line: number          // 1-based line number
  content: string       // full line text
  submatches: Array<{
    start: number       // byte offset within line
    end: number
    match: string
  }>
}
```

---

## Frontend Changes

### 1. Sidebar Tab System — `packages/app/src/pages/layout/sidebar-shell.tsx`

Add a two-tab selector to `SidebarShell`:

```
┌─[files]─[search]─┐
│                   │
│   Tab content     │
│                   │
└───────────────────┘
```

- Default tab: `"files"`
- Switch via click or programmatic `switchTab("search")`
- Search tab opened by `Ctrl+Shift+F` command
- Tab state stored in `layout.sidebar.activeTab`

### 2. Layout State — `packages/app/src/context/layout.tsx`

Add to the `Sidebar` schema:

```typescript
sidebar: Schema.Struct({
  // ... existing fields
  activeTab: Schema.optional(Schema.literal("files", "search")).withDefault("files"),
  searchWidth: Schema.optional(Schema.Number).withDefault(400),
})
```

Sidebar width in search mode uses `searchWidth` (400px default, wider for match preview).
In files mode, uses the existing `width` field (344px default).

### 3. Search Context — `packages/app/src/context/search.tsx` (NEW)

```typescript
// Core state
pattern: string             // current search query
replace: string             // replace text (for future use)
caseSensitive: boolean      // [Aa] toggle
regex: boolean              // [.*] toggle
wholeWord: boolean          // [ab] toggle
includePattern: string      // files to include glob
excludePattern: string      // files to exclude glob

// Async state
results: SearchMatch[]      // raw results from API
isSearching: boolean        // loading indicator
error: string | null        // error message

// Derived state
groupedResults: Map<string, SearchMatch[]>  // results grouped by file
fileCount: number           // number of unique files
totalCount: number          // total match count
truncated: boolean          // true if result count hit limit

// UI state
expandedFiles: Set<string>  // which file groups are expanded
activeMatchIndex: number    // for keyboard navigation
```

Search is triggered automatically on pattern change with 300ms debounce. No manual
submit needed (matches VS Code behavior).

### 4. SearchPanel — `packages/app/src/components/search-panel.tsx` (NEW)

Top-level container. Renders: SearchInput → SearchFilterBar → SearchResultsTree.

- Reads from `useSearch()` context
- Handles keyboard event routing (Escape to clear/close, F4 for next match)

### 5. SearchInput — `packages/app/src/components/search/search-input.tsx` (NEW)

- Primary search `<input>` with `variant="ghost"`, autofocus on mount
- Collapsible replace `<input>` below, toggled by Ctrl+H or the toggle button
- Right side: `SearchToggleBar` with three toggle buttons

### 6. SearchToggleBar — `packages/ui/src/components/search-toggle.tsx` (NEW)

Three `ToggleButton` components in a row:

| Button | Label | Active state | Description |
|--------|-------|-------------|-------------|
| `[Aa]` | Match Case | accent highlight | Enables case-sensitive search |
| `[.*]` | Use Regex | accent highlight | Treat pattern as regex |
| `[ab]` | Match Whole Word | accent highlight | Only match whole words |

Uses `--text-interactive-base` for active state, `--text-weak` for inactive.
Size: `small` (height 24px, font-size 12px).

### 7. SearchFilterBar — `packages/app/src/components/search/search-filter.tsx` (NEW)

Two inline text inputs below the search box:

```
files to include: *.ts      files to exclude: node_modules
```

- Passed to ripgrep as `include` glob and `exclude` glob
- Default include: empty (search all)
- Default exclude: `node_modules,.git,dist,build` (common ignore patterns)
- On change: re-triggers search immediately

### 8. SearchResultsTree — `packages/app/src/components/search/search-results.tsx` (NEW)

A scrollable tree of `SearchFileGroup` components.

- Empty state: "No results found in workspace"
- Loading state: Spinner component
- Error state: error message with retry button
- Over-limit state: "Showing 200 of N+ matches. Refine your search."
- Total summary in header: "N results in M files"

### 9. SearchFileGroup — `packages/app/src/components/search/search-file-group.tsx` (NEW)

Collapsible section for a single file's matches.

```
▼ src/tool/grep.ts  3 matches          ← FileHeader
  42: export const grep = tool.define(  ← SearchResultItem
  89:   await grep.execute(input)       ← SearchResultItem
  156: const result = grep.search()     ← SearchResultItem
```

**FileHeader:**
- Click to expand/collapse
- Shows filename + match count badge
- Collapse icon (chevron-down/chevron-right)

**Expanded behavior:**
- Initially all file groups with ≤3 matches are expanded
- Groups with >3 matches start collapsed

### 10. SearchResultItem — `packages/app/src/components/search/search-result-item.tsx` (NEW)

Single match line display.

```
  42: export const [grep] = tool.define(...
  ^^   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  line  content with match text highlighted
  number
```

- Line number in `--text-weak`, monospace, right-aligned (min-width: 4ch)
- Content: full line text, with submatch ranges highlighted via `<mark>` or equivalent
- Content truncated with ellipsis if line is very long
- Active item: highlighted with `--surface-raised-base-hover` (reuse List's active style)
- Click: `command.trigger("file.open", { path, line })`
- Supports context menu (right-click): Copy, Copy Path, Open in Editor

---

## Interaction Specification

### Keyboard Shortcuts

| Key | Context | Action |
|-----|---------|--------|
| `Ctrl+Shift+F` | Global | Open search panel, focus search input |
| `Enter` | Search input has focus | Focus first result |
| `Escape` | Search input has focus, has text | Clear search input |
| `Escape` | Search input has focus, empty | Close search panel, switch to files tab |
| `F4` | Anywhere in search panel | Go to next match across all files |
| `Shift+F4` | Anywhere in search panel | Go to previous match across all files |
| `↑` / `↓` | Results area focused | Navigate between match items |
| `←` / `→` | File header focused | Collapse / expand file group |
| `Space` | File header focused | Toggle expand/collapse |
| `Ctrl+H` | Search input focused | Toggle replace input visibility |

### Click Behavior

| Target | Action |
|--------|--------|
| Search result item | Open file at line, focus stays on editor |
| File header | Expand/collapse file group |
| Tab [files] | Switch to files tab, keep search results in memory |
| Tab [search] | Switch to search tab, refocus search input |

### Search Trigger Rules

- Pattern length ≥ 2: search triggers after 300ms of no typing
- Pattern length < 2: clear results (don't search empty/single-char queries)
- Toggle change (Aa/.*/ab): re-search immediately with same pattern
- Filter change: re-search immediately with same pattern
- On panel close and reopen: keep last results but refocus input

---

## File Change Summary

### Modified Files

| File | Change |
|------|--------|
| `packages/app/src/pages/layout/sidebar-shell.tsx` | Add tab system (files/search) |
| `packages/app/src/context/layout.tsx` | Add `activeTab`, `searchWidth` fields |
| `packages/app/src/context/command.tsx` | Register `search.open` command with `Ctrl+Shift+F` |
| `packages/opencode/src/config/keybinds.ts` | Add `search` keybind entry (default `ctrl+shift+f`) |
| `packages/opencode/src/server/routes/instance/httpapi/file.ts` | Add `limit`, `exclude`, `caseSensitive`, `wholeWord` query params; remove hardcoded `limit: 10` |
| `packages/opencode/src/file/ripgrep.ts` | Minor: expose `exclude`, `caseSensitive`, `wholeWord` in `SearchInput` |

### New Files

| File | Purpose |
|------|---------|
| `packages/app/src/context/search.tsx` | Search state management (context + provider) |
| `packages/app/src/components/search-panel.tsx` | Top-level search panel container |
| `packages/app/src/components/search/search-input.tsx` | Search/replace inputs + toggle bar |
| `packages/app/src/components/search/search-filter.tsx` | File include/exclude filter bar |
| `packages/app/src/components/search/search-results.tsx` | Results tree container |
| `packages/app/src/components/search/search-file-group.tsx` | Per-file collapsible result group |
| `packages/app/src/components/search/search-result-item.tsx` | Single match line item |
| `packages/ui/src/components/search-toggle.tsx` | Toggle button for Aa / .* / ab |

---

## Edge Cases & Error Handling

| Scenario | Behavior |
|----------|----------|
| Ripgrep not installed | Auto-download (existing behavior). Show "Installing ripgrep..." |
| Search timeout (>10s) | Abort, show "Search timed out. Try a more specific query." |
| Empty workspace / no files | Show "No files to search in workspace" |
| Regex syntax error | Show "Invalid regex pattern: <error>" in search bar |
| Very large result set (>10k matches) | Ripgrep `--max-count` limits. Show "Showing first N matches" |
| File deleted between search and click | Show toast "File no longer exists" |
| Network error | Show error state with retry button |
| Sidebar closed when search triggered | Auto-open sidebar, switch to search tab |
| Sidebar too narrow for results | Min-width enforced at 320px for search mode |
| No pattern entered | Clear results, show placeholder "Search files by name or content" |

---

## Testing Strategy

### Unit Tests
- Search context state transitions (idle → searching → results → error)
- Grouping logic: `groupBy(results, 'file')` returns correct Map
- Toggle state toggles correctly

### Integration Tests
- SearchPanel renders and responds to input
- 300ms debounce is respected
- Toggle changes re-trigger search
- Results expand/collapse correctly
- Keyboard navigation works as specified

### E2E Tests (Playwright)
- `Ctrl+Shift+F` opens search panel
- Type query → results appear
- Click result → file opens at correct line
- F4 navigates through matches
- Escape clears and closes

---

## Out of Scope (Future Iterations)

1. Replace-in-files functionality
2. Search across multiple workspaces
3. LSP symbol search (workspace/symbol) — can be a separate tab or mode
4. Search history persistence
5. "Open in editor" to see results in a dedicated diff-style panel
6. Search result context actions (exclude file, copy all matches, etc.)
7. File name search integration (handled separately by Ctrl+P)
8. TUI search panel equivalent
