/**
 * The height the host actually shows the app at, and how the frame is sized.
 *
 * - "content": inline mode (and pip without a reported height). The host sizes
 *   the iframe from our size-changed notifications, so we must not fill it.
 * - "fixed": the host gives us a fixed-height frame (`containerDimensions.height`,
 *   or no dimensions at all in fullscreen/split/standalone). We fill it.
 * - "panel": a resizable host panel that reports `containerDimensions.maxHeight`
 *   and stretches the iframe to at least that height (newer Goose builds do
 *   this for pip and split modes). We fill it without contributing to our
 *   reported height, so the host's floor alone decides the frame height and a
 *   resize never leaves the frame at a stale, taller height (which makes the
 *   panel scroll).
 *
 * `window.innerHeight` can be a stale iframe height rather than what the user
 * sees (Goose's older pip keeps the iframe at whatever height we last
 * reported), so the host-reported height is preferred when present.
 *
 * Panel mode assumes the host floors the frame at maxHeight. A host that
 * instead sizes the frame to our content would shrink it to nothing, so if the
 * frame settles well short of maxHeight we fall back to "fixed" for the rest of
 * the session.
 */

import { useEffect, useState } from "react"
import { useMcpApp } from "./use-mcp-app"
import { useDisplayMode } from "./use-display-mode"
import type { DisplayMode } from "../../shared/display-modes"

export type FrameMode = "content" | "fixed" | "panel"

export interface Viewport {
  displayMode: DisplayMode
  frame: FrameMode
  /** True when the board should fill the frame's height ("fixed" or "panel"). */
  fixed: boolean
  /** Visible height reported by the host, or null to use `window.innerHeight`. */
  height: number | null
}

/** Session-wide: set once a host is seen not to floor the frame at maxHeight. */
let panelUnsupported = false
const panelListeners = new Set<() => void>()
const PANEL_SETTLE_MS = 600

export function useViewport(): Viewport {
  const { displayMode } = useDisplayMode()
  const { hostContext } = useMcpApp()
  const [, forceRender] = useState(0)

  let fixedHeight: number | null = null
  let maxHeight: number | null = null
  const dims = hostContext?.containerDimensions
  if (displayMode !== "inline" && dims) {
    if ("height" in dims && dims.height > 0) fixedHeight = dims.height
    else if ("maxHeight" in dims && dims.maxHeight && dims.maxHeight > 0)
      maxHeight = dims.maxHeight
  }

  let frame: FrameMode
  let height: number | null
  if (displayMode === "inline") {
    frame = "content"
    height = null
  } else if (fixedHeight !== null) {
    frame = "fixed"
    height = Math.floor(fixedHeight)
  } else if (maxHeight !== null) {
    frame = panelUnsupported ? "fixed" : "panel"
    height = Math.floor(maxHeight)
  } else if (displayMode === "pip") {
    frame = "content"
    height = null
  } else {
    frame = "fixed"
    height = null
  }

  useEffect(() => {
    const listener = () => forceRender((n) => n + 1)
    panelListeners.add(listener)
    return () => {
      panelListeners.delete(listener)
    }
  }, [])

  // Guard for panel mode: once the frame has settled, it should be at least
  // the reported maxHeight. If it isn't, this host sizes to content.
  useEffect(() => {
    if (frame !== "panel" || height === null) return
    let timer = 0
    const check = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        if (panelUnsupported || window.innerHeight >= height - 2) return
        console.warn(
          "[useViewport] host did not stretch the frame to maxHeight; " +
            "falling back to fixed-frame layout"
        )
        panelUnsupported = true
        panelListeners.forEach((notify) => notify())
      }, PANEL_SETTLE_MS)
    }
    check()
    window.addEventListener("resize", check)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener("resize", check)
    }
  }, [frame, height])

  return { displayMode, frame, fixed: frame !== "content", height }
}
