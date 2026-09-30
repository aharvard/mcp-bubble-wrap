/**
 * Resolves the colour theme the widget should render in.
 *
 * Priority: host-provided theme (ChatGPT `window.openai.theme`, or the MCP
 * Apps `hostContext.theme` delivered in `ui/initialize` and
 * `ui/notifications/host-context-changed`) → OS `prefers-color-scheme`.
 */

import { useSyncExternalStore } from "react"
import { useOpenAiGlobal } from "./use-openai-global"
import { isOpenAiHost, useMcpApp } from "./use-mcp-app"

export type Theme = "light" | "dark"

const DARK_QUERY = "(prefers-color-scheme: dark)"

function subscribeToSystemTheme(onChange: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {}
  const media = window.matchMedia(DARK_QUERY)
  media.addEventListener("change", onChange)
  return () => media.removeEventListener("change", onChange)
}

function getSystemTheme(): Theme {
  if (typeof window === "undefined" || !window.matchMedia) return "light"
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light"
}

export function useSystemTheme(): Theme {
  return useSyncExternalStore(
    subscribeToSystemTheme,
    getSystemTheme,
    () => "light"
  )
}

export function useTheme(): { theme: Theme; source: "host" | "system" } {
  const openAiTheme = useOpenAiGlobal("theme")
  const { hostContext } = useMcpApp()
  const systemTheme = useSystemTheme()

  const hostTheme = isOpenAiHost() ? openAiTheme : hostContext?.theme
  if (hostTheme === "light" || hostTheme === "dark") {
    return { theme: hostTheme, source: "host" }
  }
  return { theme: systemTheme, source: "system" }
}
