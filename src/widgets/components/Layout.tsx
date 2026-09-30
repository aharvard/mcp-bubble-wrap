import React, { useEffect, useLayoutEffect, useRef } from "react"
import { useOpenAiGlobal } from "../hooks/use-openai-global"
import { isOpenAiHost, useMcpApp } from "../hooks/use-mcp-app"
import { useDisplayMode } from "../hooks/use-display-mode"
import { useTheme } from "../hooks/use-theme"
import { useViewport } from "../hooks/use-viewport"
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
 * - Exposes the current display mode on <html> as `data-display-mode`, whether
 *   the frame is content-sized, fixed or a resizable panel as `data-frame`, and the
 *   visible height as `--bw-vh`. The stylesheet uses these to decide whether
 *   the document fills the frame and may scroll
 * - Reports size changes to mcp-ui hosts (MCP Apps hosts are handled by the
 *   ext-apps SDK's auto-resize)
 */
export const Layout: React.FC<LayoutProps> = ({ children, className }) => {
  const maxHeight = useOpenAiGlobal("maxHeight")
  const safeArea = useOpenAiGlobal("safeArea")
  const { app, hostContext, isConnected } = useMcpApp()
  const { displayMode, availableDisplayModes } = useDisplayMode()
  const { theme, source: themeSource } = useTheme()
  const viewport = useViewport()

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

  useLayoutEffect(() => {
    const root = document.documentElement
    root.classList.toggle("dark", theme === "dark")
    root.dataset.theme = theme
    root.dataset.displayMode = displayMode
    root.dataset.frame = viewport.frame
    root.style.setProperty(
      "--bw-vh",
      viewport.height ? `${viewport.height}px` : "100vh"
    )
  }, [theme, displayMode, viewport.frame, viewport.height])

  // Report our size to MCP Apps hosts right after every render, in addition to
  // the SDK's auto-resize. The SDK waits for requestAnimationFrame, which
  // Chromium throttles in tiny or hidden cross-origin frames; after a display
  // mode switch the host may briefly size the frame that small (Goose restores
  // the last reported height when returning to inline), and the SDK's report
  // could then arrive late or not at all. Measured the same way as the SDK.
  const lastReportedSize = useRef<{ width: number; height: number } | null>(
    null
  )
  useLayoutEffect(() => {
    if (!app || isOpenAiHost()) return
    const root = document.documentElement
    const previous = root.style.height
    root.style.height = "max-content"
    const height = Math.ceil(root.getBoundingClientRect().height)
    root.style.height = previous
    const width = Math.ceil(window.innerWidth)
    const last = lastReportedSize.current
    if (last && last.width === width && last.height === height) return
    lastReportedSize.current = { width, height }
    app.sendSizeChanged({ width, height }).catch((error: unknown) => {
      console.warn("[Layout] size report failed:", error)
    })
  })

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
