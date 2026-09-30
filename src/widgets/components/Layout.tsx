import React, { useEffect, useRef } from "react"
import { useOpenAiGlobal } from "../hooks/use-openai-global"
import { isOpenAiHost, useMcpApp } from "../hooks/use-mcp-app"
import { useDisplayMode } from "../hooks/use-display-mode"
import { useTheme } from "../hooks/use-theme"
import "../styles.css"

interface LayoutProps {
  children: React.ReactNode
  className?: string
}

/**
 * Layout - A top-level wrapper component for widgets that:
 * - Resolves the theme from whichever host is present (ChatGPT's
 *   `window.openai` or an MCP Apps host via ext-apps), falling back to the OS
 *   preference, and applies it to <html> (`dark` class + `data-theme`) so the
 *   whole document, not just this subtree, follows it
 * - Exposes the current display mode on <html> as `data-display-mode`, which
 *   the stylesheet uses to decide whether the document may scroll
 * - Reports size changes to mcp-ui hosts (MCP Apps hosts are handled by the
 *   ext-apps SDK's auto-resize)
 */
export const Layout: React.FC<LayoutProps> = ({ children, className }) => {
  const maxHeight = useOpenAiGlobal("maxHeight")
  const safeArea = useOpenAiGlobal("safeArea")
  const { hostContext, isConnected } = useMcpApp()
  const { displayMode, availableDisplayModes } = useDisplayMode()
  const { theme, source: themeSource } = useTheme()

  // inspect these values to see what the host is passing in
  console.log("[Layout] host state", {
    host: isOpenAiHost() ? "openai" : isConnected ? "mcp-apps" : "unknown",
    theme,
    themeSource,
    displayMode,
    availableDisplayModes,
    maxHeight,
    safeArea,
    hostContext,
  })

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle("dark", theme === "dark")
    root.dataset.theme = theme
    root.dataset.displayMode = displayMode
  }, [theme, displayMode])

  const mcpUiContainer = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // mcp-ui hosts (the /mcp route) listen for this message. MCP Apps hosts
    // receive `ui/notifications/size-changed` from the ext-apps SDK instead.
    function postSize() {
      const height = mcpUiContainer.current?.scrollHeight ?? 0
      const width = mcpUiContainer.current?.scrollWidth ?? 0

      const payload = { height, width }
      window.parent.postMessage({ type: "ui-size-change", payload }, "*")
    }

    if (!mcpUiContainer.current) return

    // Post initial size on mount
    postSize()

    const resizeObserver = new ResizeObserver(() => {
      postSize()
    })

    resizeObserver.observe(mcpUiContainer.current)

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  return (
    <div
      data-theme={theme}
      data-display-mode={displayMode}
      className={className}
      ref={mcpUiContainer}
    >
      {children}
    </div>
  )
}
