import React, { useMemo } from "react"
import { useOpenAiGlobal } from "../hooks/use-openai-global"
import "../styles.css"

interface LayoutProps {
  children: React.ReactNode
  className?: string
  /**
   * Apply max height constraint from OpenAI globals
   * @default true
   */
  applyMaxHeight?: boolean
  /**
   * Apply safe area insets as padding
   * @default false
   */
  applySafeArea?: boolean
  /**
   * Custom background color class (overrides default theme background)
   */
  backgroundColor?: string
  /**
   * Force a specific theme (useful for development/testing)
   * If not provided, uses OpenAI global theme or defaults to "light"
   */
  forceTheme?: "light" | "dark"
}

/**
 * Layout - A top-level wrapper component for widgets that:
 * - Applies theme (light/dark mode) via Tailwind classes
 * - Handles layout constraints (max-height, safe areas)
 * - Provides consistent visual styling across widgets
 */
export const Layout: React.FC<LayoutProps> = ({
  children,
  className = "",
  applyMaxHeight = false,
  applySafeArea = false,
  backgroundColor,
  forceTheme,
}) => {
  const globalTheme = useOpenAiGlobal("theme")
  const theme = forceTheme || globalTheme || "light"
  const maxHeight = useOpenAiGlobal("maxHeight")
  const safeArea = useOpenAiGlobal("safeArea")
  const displayMode = useOpenAiGlobal("displayMode")

  // inspect these values to see what ChatGPT is passing in
  console.log({
    globalTheme,
    theme,
    forceTheme,
    maxHeight,
    safeArea,
    displayMode,
  })

  // Build dynamic styles
  const style = useMemo(() => {
    const styles: React.CSSProperties = {}

    if (applyMaxHeight && maxHeight) {
      styles.maxHeight = `${maxHeight}px`
    }

    if (applySafeArea && safeArea) {
      const { top, right, bottom, left } = safeArea.insets
      styles.paddingTop = `${top}px`
      styles.paddingRight = `${right}px`
      styles.paddingBottom = `${bottom}px`
      styles.paddingLeft = `${left}px`
    }

    return styles
  }, [applyMaxHeight, maxHeight, applySafeArea, safeArea])

  // Theme class for outer wrapper
  const themeClass = useMemo(() => {
    const effectiveTheme = theme || "light"
    return effectiveTheme === "dark" ? "dark" : ""
  }, [theme])

  // Build dynamic class names for inner content wrapper
  const contentClasses = useMemo(() => {
    const classes = [
      // Base classes
      "widget-wrapper",
      "w-full",
      "h-full",

      // Display mode specific classes
      displayMode === "fullscreen" ? "overflow-auto" : "",
      displayMode === "pip" ? "overflow-hidden" : "",

      // Background color (default or custom)
      backgroundColor || "bg-white dark:bg-black",

      // Text color for theme
      "text-gray-900 dark:text-gray-100",

      // Custom classes
      className,
    ]

    return classes.filter(Boolean).join(" ")
  }, [displayMode, backgroundColor, className])

  return (
    <div className={themeClass} data-theme={theme || "light"}>
      <div className={contentClasses} style={style}>
        {children}
      </div>
    </div>
  )
}
