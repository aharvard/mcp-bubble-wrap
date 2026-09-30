/**
 * The height the host actually shows the app at, and whether that height is
 * fixed by the host or follows our content.
 *
 * Inline mode always follows content (the host sizes the iframe from our
 * size-changed notifications). Other modes normally give us a fixed viewport,
 * but a host may keep the iframe at its old height and clip or scroll it
 * inside a smaller box. Goose's picture-in-picture window does this: the
 * iframe keeps whatever height we last reported (for example the fullscreen
 * height) inside a small scrolling window. There, `window.innerHeight` is the
 * stale iframe height, not what the user sees, so we prefer the host's
 * `containerDimensions.height`.
 *
 * Picture-in-picture without a reported height is treated like inline: we size
 * to our content rather than lock in a stale frame height.
 */

import { useMcpApp } from "./use-mcp-app"
import { useDisplayMode } from "./use-display-mode"
import type { DisplayMode } from "../../shared/display-modes"

export interface Viewport {
  displayMode: DisplayMode
  /** True when the host gives us a fixed-height frame to fill. */
  fixed: boolean
  /** Visible height reported by the host, or null to use `window.innerHeight`. */
  height: number | null
}

export function useViewport(): Viewport {
  const { displayMode } = useDisplayMode()
  const { hostContext } = useMcpApp()

  let height: number | null = null
  const dims = hostContext?.containerDimensions
  if (displayMode !== "inline" && dims && "height" in dims && dims.height > 0) {
    height = Math.round(dims.height)
  }

  const fixed =
    displayMode !== "inline" && (displayMode !== "pip" || height !== null)

  return { displayMode, fixed, height: fixed ? height : null }
}
