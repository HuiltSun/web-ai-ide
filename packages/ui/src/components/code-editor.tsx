import {
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  splitProps,
  untrack,
  type ComponentProps,
} from "solid-js"
import { EditorState, type Extension } from "@codemirror/state"
import {
  EditorView,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  type KeyBinding,
} from "@codemirror/view"
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands"
import { bracketMatching, foldGutter, foldKeymap, indentOnInput, syntaxHighlighting, HighlightStyle } from "@codemirror/language"
import { tags } from "@lezer/highlight"
import { autocompletion, closeBrackets, completionKeymap } from "@codemirror/autocomplete"
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search"
import { javascript } from "@codemirror/lang-javascript"
import { json } from "@codemirror/lang-json"
import { html } from "@codemirror/lang-html"
import { css } from "@codemirror/lang-css"
import { markdown } from "@codemirror/lang-markdown"
import { python } from "@codemirror/lang-python"
import { rust } from "@codemirror/lang-rust"
import { sql } from "@codemirror/lang-sql"
import { go } from "@codemirror/lang-go"
import type { LanguageSupport } from "@codemirror/language"

const langMap: Record<string, () => LanguageSupport> = {
  js: javascript,
  jsx: () => javascript({ jsx: true }),
  mjs: javascript,
  cjs: javascript,
  ts: () => javascript({ typescript: true }),
  tsx: () => javascript({ jsx: true, typescript: true }),
  mts: () => javascript({ typescript: true }),
  cts: () => javascript({ typescript: true }),
  json: json,
  jsonc: json,
  html: html,
  htm: html,
  css: css,
  scss: css,
  less: css,
  md: markdown,
  mdx: markdown,
  markdown: markdown,
  py: python,
  python: python,
  pyi: python,
  rs: rust,
  rust: () => rust(),
  sql: sql,
  go: go,
  mod: go,
}

function extForPath(path?: string): LanguageSupport | undefined {
  if (!path) return
  const ext = path.split(".").pop()?.toLowerCase()
  if (!ext) return
  const fn = langMap[ext]
  return fn?.()
}

const industrialTheme = EditorView.theme({
  "&": { height: "100%", backgroundColor: "var(--background-stronger)", color: "var(--text-base)" },
  ".cm-scroller": { lineHeight: "1.65", fontFamily: "inherit" },
  ".cm-content": { caretColor: "var(--border-interactive-base)", padding: "0" },
  "&.cm-focused": { outline: "none" },
  "&.cm-focused .cm-cursor": {
    borderLeftColor: "var(--border-interactive-base)",
    borderLeftWidth: "2px",
  },
  ".cm-gutters": {
    backgroundColor: "var(--background-base)",
    borderRight: "1px solid var(--border-weaker-base)",
    color: "var(--text-weaker)",
    minWidth: "44px",
  },
  ".cm-lineNumbers .cm-gutterElement": { paddingLeft: "4px", paddingRight: "12px" },
  ".cm-activeLineGutter": {
    backgroundColor: "var(--surface-base)",
    color: "var(--text-weak)",
  },
  ".cm-foldGutter .cm-gutterElement": { paddingLeft: "4px" },
  ".cm-activeLine": { backgroundColor: "var(--surface-base)" },
  ".cm-selectionBackground": { backgroundColor: "var(--surface-interactive-weak) !important" },
  "&.cm-focused .cm-selectionBackground": {
    backgroundColor: "var(--surface-interactive-weak) !important",
  },
  ".cm-selectionMatch": { backgroundColor: "var(--surface-interactive-weak)" },
  ".cm-matchingBracket": {
    backgroundColor: "var(--surface-interactive-weak)",
    outline: "1px solid var(--border-interactive-base)",
    borderRadius: "1px",
  },
  ".cm-nonmatchingBracket": {
    backgroundColor: "var(--surface-critical-weak)",
    outline: "1px solid var(--border-critical-base)",
  },
  ".cm-tooltip": {
    backgroundColor: "var(--background-stronger)",
    border: "1px solid var(--border-weak-base)",
    borderRadius: "3px",
  },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
    backgroundColor: "var(--surface-interactive-weak)",
    color: "var(--text-base)",
  },
  ".cm-foldPlaceholder": {
    backgroundColor: "var(--surface-base)",
    border: "1px solid var(--border-weak-base)",
    borderRadius: "2px",
    color: "var(--text-weaker)",
    padding: "0 4px",
  },
  ".cm-searchMatch": {
    backgroundColor: "var(--surface-warning-weak)",
    outline: "1px solid var(--border-warning-base)",
  },
  ".cm-searchMatch.cm-searchMatch-selected": { backgroundColor: "var(--surface-warning-base)" },
})

const industrialHighlight = HighlightStyle.define([
  { tag: tags.keyword,                                           color: "var(--syntax-keyword)", fontWeight: "500" },
  { tag: [tags.controlKeyword, tags.moduleKeyword],             color: "var(--syntax-keyword)" },
  { tag: [tags.typeName, tags.className, tags.namespace],       color: "var(--syntax-type)" },
  { tag: tags.string,                                           color: "var(--syntax-string)" },
  { tag: tags.special(tags.string),                             color: "var(--syntax-string)" },
  { tag: tags.regexp,                                           color: "var(--syntax-regexp)" },
  { tag: [tags.number, tags.bool],                              color: "var(--syntax-primitive)" },
  { tag: tags.null,                                             color: "var(--syntax-primitive)" },
  { tag: [tags.function(tags.variableName),
           tags.function(tags.propertyName)],                   color: "var(--syntax-constant)" },
  { tag: tags.definition(tags.function(tags.variableName)),     color: "var(--syntax-constant)" },
  { tag: tags.variableName,                                     color: "var(--syntax-variable)" },
  { tag: tags.definition(tags.variableName),                    color: "var(--syntax-variable)" },
  { tag: tags.propertyName,                                     color: "var(--syntax-property)" },
  { tag: tags.operator,                                         color: "var(--syntax-operator)" },
  { tag: tags.punctuation,                                      color: "var(--syntax-punctuation)" },
  { tag: tags.bracket,                                          color: "var(--syntax-punctuation)" },
  { tag: [tags.comment, tags.lineComment, tags.blockComment],   color: "var(--syntax-comment)", fontStyle: "italic" },
  { tag: tags.tagName,                                          color: "var(--syntax-keyword)" },
  { tag: tags.attributeName,                                    color: "var(--syntax-property)" },
  { tag: tags.attributeValue,                                   color: "var(--syntax-string)" },
  { tag: [tags.annotation, tags.meta],                          color: "var(--syntax-comment)" },
  { tag: tags.modifier,                                         color: "var(--syntax-keyword)", fontWeight: "500" },
  { tag: tags.self,                                             color: "var(--syntax-primitive)" },
  { tag: tags.escape,                                           color: "var(--syntax-constant)" },
  { tag: tags.heading,                                          color: "var(--markdown-heading)", fontWeight: "600" },
  { tag: tags.strong,                                           fontWeight: "700" },
  { tag: tags.emphasis,                                         fontStyle: "italic" },
  { tag: tags.link,                                             color: "var(--markdown-link)", textDecoration: "underline" },
  { tag: tags.strikethrough,                                    textDecoration: "line-through" },
  { tag: tags.deleted,                                          color: "var(--syntax-diff-delete)" },
  { tag: tags.inserted,                                         color: "var(--syntax-diff-add)" },
  { tag: tags.changed,                                          color: "var(--syntax-warning)" },
])

const baseExtensions: Extension[] = [
  lineNumbers(),
  highlightActiveLineGutter(),
  highlightSpecialChars(),
  history(),
  foldGutter(),
  drawSelection(),
  dropCursor(),
  EditorState.allowMultipleSelections.of(true),
  indentOnInput(),
  industrialTheme,
  syntaxHighlighting(industrialHighlight, { fallback: true }),
  bracketMatching(),
  closeBrackets(),
  autocompletion(),
  highlightActiveLine(),
  highlightSelectionMatches(),
  keymap.of([
    ...defaultKeymap,
    ...historyKeymap,
    ...foldKeymap,
    ...completionKeymap,
    ...searchKeymap,
    indentWithTab,
  ]),
  EditorView.lineWrapping,
]

export type CodeEditorHandle = {
  getValue(): string
  setValue(value: string): void
  undo(): void
  redo(): void
  focus(): void
  getSelection(): { from: number; to: number }
  setCursor(pos: number): void
  readonly view: EditorView | undefined
}

type CodeEditorProps = {
  value?: string
  path?: string
  language?: string
  readOnly?: boolean
  onChange?: (value: string) => void
  onCursorActivity?: (pos: number) => void
  extensions?: Extension[]
  decorations?: Extension
  class?: string
  classList?: ComponentProps<"div">["classList"]
  style?: ComponentProps<"div">["style"]
  handleRef?: (handle: CodeEditorHandle) => void
  autoFocus?: boolean
  onSave?: () => void
}

export function CodeEditor(props: CodeEditorProps) {
  let container!: HTMLDivElement
  let view: EditorView | undefined
  const [local] = splitProps(props, [
    "value",
    "path",
    "language",
    "readOnly",
    "onChange",
    "onCursorActivity",
    "extensions",
    "decorations",
    "handleRef",
    "autoFocus",
    "onSave",
  ])

  const langExt = createMemo(() => extForPath(local.path))

  const saveBinding: KeyBinding = {
    key: "Mod-s",
    run: () => {
      local.onSave?.()
      return true
    },
    preventDefault: true,
  }

  const init = () => {
    const exts: Extension[] = [
      ...baseExtensions,
      keymap.of([saveBinding]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          local.onChange?.(update.state.doc.toString())
        }
        if (update.selectionSet) {
          const pos = update.state.selection.main.head
          local.onCursorActivity?.(pos)
        }
      }),
    ]

    const lang = langExt()
    if (lang) exts.push(lang)

    if (local.readOnly) {
      exts.push(EditorState.readOnly.of(true))
      exts.push(EditorView.editable.of(false))
    }

    if (local.extensions) {
      exts.push(...local.extensions)
    }

    if (local.decorations) {
      exts.push(local.decorations)
    }

    const state = EditorState.create({
      doc: local.value ?? "",
      extensions: exts,
    })

    view = new EditorView({
      state,
      parent: container,
    })

    if (local.autoFocus) {
      view.focus()
    }

    const handle: CodeEditorHandle = {
      getValue: () => view?.state.doc.toString() ?? "",
      setValue: (value: string) => {
        const v = view
        if (!v) return
        v.dispatch({
          changes: { from: 0, to: v.state.doc.length, insert: value },
        })
      },
      undo: () => {
        const v = view
        if (!v) return
        ;(window as any).__cm_undo?.(v)
      },
      redo: () => {
        const v = view
        if (!v) return
        ;(window as any).__cm_redo?.(v)
      },
      focus: () => view?.focus(),
      getSelection: () => {
        const v = view
        if (!v) return { from: 0, to: 0 }
        const sel = v.state.selection.main
        return { from: sel.from, to: sel.to }
      },
      setCursor: (pos: number) => {
        const v = view
        if (!v) return
        v.dispatch({ selection: { anchor: pos } })
      },
      get view() {
        return view
      },
    }

    local.handleRef?.(handle)
  }

  const destroy = () => {
    if (view) {
      view.destroy()
      view = undefined
    }
  }

  onMount(init)
  onCleanup(destroy)

  createEffect(() => {
    const v = view
    if (!v) return
    const next = local.value
    if (next === undefined) return
    const current = v.state.doc.toString()
    if (next !== current) {
      v.dispatch({
        changes: { from: 0, to: v.state.doc.length, insert: next },
      })
    }
  })

  return (
    <div
      ref={container}
      class={props.class}
      classList={props.classList}
      style={props.style}
      data-component="code-editor"
    />
  )
}
