/**
 * Sizes the bubble grid to the space the host actually gives us.
 *
 * - Every mode: columns are derived from the measured container width and a
 *   comfortable target bubble size, instead of window-width breakpoints.
 * - Fixed-height frames (fullscreen, split-*, standalone, pip when the host
 *   reports its height; see use-viewport.ts): the host hands us a
 *   fixed viewport, so we additionally try to pick the largest bubble size at
 *   which *all* bubbles fit in the available height. When that's possible the
 *   page never needs to scroll; when it isn't (tiny viewport, huge count) we
 *   fall back to the width-based layout and let the document scroll.
 * - Content-sized frames (inline): the iframe grows with the content (autoResize), so height
 *   fitting is meaningless and only the width rule applies.
 */

import { useEffect, useState, type RefObject } from "react"

export const BUBBLE_GAP = 8
const TARGET_BUBBLE = 56
const MIN_BUBBLE = 26
const MAX_BUBBLE = 96
const MIN_COLUMNS = 3

export interface BubbleLayout {
  /** Number of grid columns. */
  columns: number
  /** Bubble diameter in CSS px. */
  size: number
  /** True when every bubble fits the available height (no scrolling needed). */
  fitsViewport: boolean
  /** Height (px) the grid may occupy outside inline mode; 0 in inline mode. */
  availableHeight: number
}

/** Never more columns than bubbles, so 1 or 2 bubbles form a single centered row. */
function minColumns(bubbleCount: number): number {
  return Math.max(1, Math.min(MIN_COLUMNS, bubbleCount))
}

/**
 * True when some odd (half-step shifted) row reaches the last column, so the
 * grid needs an extra half bubble of width. Row 1 is the first odd row; it is
 * only full-width when there are 3+ rows or it is completely filled.
 */
export function needsHalfStep(bubbleCount: number, columns: number): boolean {
  const rows = Math.ceil(bubbleCount / Math.max(columns, 1))
  return rows >= 3 || (rows === 2 && bubbleCount === 2 * columns)
}

/** Height of the grid for a given layout. */
export function gridHeight(
  bubbleCount: number,
  columns: number,
  size: number
): number {
  const rows = Math.ceil(bubbleCount / Math.max(columns, 1))
  return rows * size + Math.max(rows - 1, 0) * BUBBLE_GAP
}

interface Options {
  bubbleCount: number
  /** Fit the grid to the viewport height (fixed-height frames only). */
  fitHeight: boolean
  /** Visible viewport height from the host, or null for `window.innerHeight`. */
  viewportHeight: number | null
  /** Element the grid lives in; its content width is the layout width. */
  containerRef: RefObject<HTMLElement | null>
  /** Vertical space (px) that is *not* available to the grid: header, controls, padding. */
  reservedHeight: number
}

/** Largest bubble size at which `columns` bubbles fit in `width`. */
function sizeForColumns(width: number, columns: number): number {
  return (width - (columns - 1) * BUBBLE_GAP) / (columns + 0.5)
}

function widthBasedLayout(width: number, bubbleCount: number): BubbleLayout {
  const raw = Math.round((width + BUBBLE_GAP) / (TARGET_BUBBLE + BUBBLE_GAP))
  const columns = Math.max(
    minColumns(bubbleCount),
    Math.min(raw, Math.max(bubbleCount, 1))
  )
  const size = Math.min(
    MAX_BUBBLE,
    Math.max(MIN_BUBBLE, sizeForColumns(width, columns))
  )
  return { columns, size, fitsViewport: false, availableHeight: 0 }
}

export function computeBubbleLayout(
  width: number,
  height: number,
  bubbleCount: number,
  fitHeight: boolean
): BubbleLayout {
  if (width <= 0 || bubbleCount <= 0) {
    return {
      columns: minColumns(bubbleCount),
      size: TARGET_BUBBLE,
      fitsViewport: false,
      availableHeight: 0,
    }
  }

  if (!fitHeight || height <= 0) return widthBasedLayout(width, bubbleCount)
  const availableHeight = height

  // Try every column count and keep the one giving the largest bubbles. Each
  // is limited by width (more columns = narrower) and by height (fewer
  // columns = more rows). Ties, which happen when bubbles hit MAX_BUBBLE, go to
  // the fewest columns so small sheets stay a compact clump.
  let best: { columns: number; size: number } | null = null
  for (
    let columns = minColumns(bubbleCount);
    columns <= bubbleCount;
    columns++
  ) {
    const rows = Math.ceil(bubbleCount / columns)
    const gaps = (columns - 1) * BUBBLE_GAP
    const widthSize = needsHalfStep(bubbleCount, columns)
      ? (width - gaps) / (columns + 0.5)
      : (width - gaps) / columns
    if (widthSize < MIN_BUBBLE) break
    const heightSize = (height - (rows - 1) * BUBBLE_GAP) / rows
    const size = Math.min(MAX_BUBBLE, widthSize, heightSize)
    if (!best || size > best.size + 0.5) best = { columns, size }
  }
  if (best && best.size >= MIN_BUBBLE) {
    return { ...best, fitsViewport: true, availableHeight }
  }

  return { ...widthBasedLayout(width, bubbleCount), availableHeight }
}

export function useBubbleLayout({
  bubbleCount,
  fitHeight,
  viewportHeight,
  containerRef,
  reservedHeight,
}: Options): BubbleLayout {
  const [layout, setLayout] = useState<BubbleLayout>(() =>
    computeBubbleLayout(0, 0, bubbleCount, false)
  )

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const measure = () => {
      const styles = getComputedStyle(el)
      const width =
        el.clientWidth -
        parseFloat(styles.paddingLeft) -
        parseFloat(styles.paddingRight)
      const height = (viewportHeight ?? window.innerHeight) - reservedHeight
      setLayout((current) => {
        const next = computeBubbleLayout(width, height, bubbleCount, fitHeight)
        return current.columns === next.columns &&
          Math.abs(current.size - next.size) < 0.5 &&
          current.fitsViewport === next.fitsViewport &&
          Math.abs(current.availableHeight - next.availableHeight) < 0.5
          ? current
          : next
      })
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    window.addEventListener("resize", measure)
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", measure)
    }
  }, [bubbleCount, fitHeight, viewportHeight, containerRef, reservedHeight])

  return layout
}
