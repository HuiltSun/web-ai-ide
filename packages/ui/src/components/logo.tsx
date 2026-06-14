import { ComponentProps } from "solid-js"

export const Mark = (props: { class?: string }) => (
  <svg
    data-component="logo-mark"
    classList={{ [props.class ?? ""]: !!props.class }}
    viewBox="0 0 32 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect x="0" y="4" width="18" height="4" rx="2" fill="var(--icon-strong-base)"/>
    <rect x="7" y="14" width="25" height="4" rx="2" fill="var(--icon-strong-base)"/>
    <rect x="0" y="24" width="18" height="4" rx="2" fill="var(--icon-strong-base)"/>
    <rect x="7" y="34" width="25" height="4" rx="2" fill="var(--icon-strong-base)"/>
  </svg>
)

export const Splash = (props: Pick<ComponentProps<"svg">, "ref" | "class">) => (
  <svg
    ref={props.ref}
    data-component="logo-splash"
    classList={{ [props.class ?? ""]: !!props.class }}
    viewBox="0 0 80 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect x="0" y="10" width="45" height="10" rx="5" fill="var(--icon-base)"/>
    <rect x="18" y="35" width="62" height="10" rx="5" fill="var(--icon-base)"/>
    <rect x="0" y="60" width="45" height="10" rx="5" fill="var(--icon-base)"/>
    <rect x="18" y="85" width="62" height="10" rx="5" fill="var(--icon-base)"/>
  </svg>
)

export const Logo = (props: { class?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 234 42"
    fill="none"
    classList={{ [props.class ?? ""]: !!props.class }}
  >
    <rect x="0" y="6" width="18" height="4" rx="2" fill="var(--icon-weak-base)"/>
    <rect x="0" y="6" width="18" height="4" rx="2" fill="var(--icon-base)" opacity="0.8"/>
    <rect x="3" y="14" width="24" height="4" rx="2" fill="var(--icon-base)"/>
    <rect x="0" y="22" width="18" height="4" rx="2" fill="var(--icon-base)" opacity="0.8"/>
    <rect x="3" y="30" width="24" height="4" rx="2" fill="var(--icon-strong-base)"/>
    <text x="40" y="30" font-family="system-ui,-apple-system,sans-serif" font-size="22" font-weight="700" fill="var(--icon-strong-base)" letter-spacing="1">Web AI IDE</text>
  </svg>
)
