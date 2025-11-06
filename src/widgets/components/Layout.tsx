import React, { useEffect, useMemo, useRef } from "react"
import { useOpenAiGlobal } from "../hooks/use-openai-global"
import "../styles.css"

interface LayoutProps {
  children: React.ReactNode
  className?: string
  /**
   * Apply max height constraint from OpenAI globals
   * @default true
   */
}

/**
 * Layout - A top-level wrapper component for widgets that:
 * - Applies theme (light/dark mode) via Tailwind classes
 * - Handles layout constraints (max-height, safe areas)
 * - Provides consistent visual styling across widgets
 */
export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const theme = useOpenAiGlobal("theme")
  const maxHeight = useOpenAiGlobal("maxHeight")
  const safeArea = useOpenAiGlobal("safeArea")
  const displayMode = useOpenAiGlobal("displayMode")

  // inspect these values to see what ChatGPT is passing in
  console.log({
    theme,
    maxHeight,
    safeArea,
    displayMode,
  })

  const mcpUiContainer = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function postSize() {
      const height = mcpUiContainer.current?.scrollHeight ?? 0
      const width = mcpUiContainer.current?.scrollWidth ?? 0

      const payload = { height, width }
      window.parent.postMessage({ type: "ui-size-change", payload }, "*")
      console.log("[Layout] posting 'ui-size-change' with payload", payload)
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
    <div data-theme={theme || "light"} ref={mcpUiContainer}>
      {children}
    </div>
  )
}
