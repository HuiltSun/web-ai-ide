export function toLinuxPath(path: string, home: string) {
  const normalized = path.replace(/\\/g, "/")
  const homeNorm = home.replace(/\\/g, "/").replace(/\/$/, "")
  if (homeNorm && normalized.startsWith(homeNorm + "/")) return "~" + normalized.slice(homeNorm.length)
  if (homeNorm && normalized === homeNorm) return "~"
  return normalized.replace(/^[A-Za-z]:/, "")
}
