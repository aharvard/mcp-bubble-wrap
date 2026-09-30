import React, { useEffect } from "react"
import { Layout } from "../components/Layout.js"
import { DisplayModeControls } from "../components/DisplayModeControls.js"
import {
  PopParticles,
  type PopParticlesHandle,
} from "../components/PopParticles.js"
import { useOpenAiGlobal } from "../hooks/use-openai-global.js"
import { isOpenAiHost, useMcpApp } from "../hooks/use-mcp-app.js"
import { useViewport } from "../hooks/use-viewport.js"
import {
  BUBBLE_GAP,
  gridHeight,
  needsHalfStep,
  useBubbleLayout,
} from "../hooks/use-bubble-layout.js"
import { playInflateSequence } from "../lib/inflate-sound.js"
import { CompletionCard } from "../components/CompletionCard.js"
import type { BubbleWrapStructuredContent } from "./types.js"

/** Vertical space kept clear under the grid for the fixed display-mode controls. */
const CONTROLS_RESERVE = 72

/**
 * Inflate-on-load stagger. Bubbles inflate one after another in reading order
 * (left to right, row by row). The per-bubble step shrinks for big sheets so
 * the whole fill never takes much longer than INFLATE_TOTAL_MS.
 */
const INFLATE_STEP_MAX_MS = 18
const INFLATE_TOTAL_MS = 1600
/** When in each bubble's inflate animation its sound lands (mid-growth). */
const INFLATE_SOUND_LEAD_MS = 110

function inflateStepMs(count: number) {
  return Math.min(INFLATE_STEP_MAX_MS, INFLATE_TOTAL_MS / count)
}

interface WidgetState {
  poppedBubbles: number[]
}

export function BubbleWrap() {
  // ChatGPT (OpenAI Apps SDK) host
  const openAiToolOutput = useOpenAiGlobal(
    "toolOutput"
  ) as BubbleWrapStructuredContent | null
  const widgetState = useOpenAiGlobal("widgetState") as WidgetState | null

  // MCP Apps host (Goose, etc.) via the ext-apps SDK
  const mcpApp = useMcpApp()
  const mcpToolOutput = (mcpApp.toolResult?.structuredContent ??
    null) as BubbleWrapStructuredContent | null
  const mcpToolInput = mcpApp.toolInput as { bubbleCount?: number } | null

  // A sheet created by the app itself in ChatGPT, where callTool() doesn't
  // necessarily update window.openai.toolOutput. Cleared as soon as the host
  // delivers a newer tool output of its own.
  const [localSheet, setLocalSheet] =
    React.useState<BubbleWrapStructuredContent | null>(null)
  React.useEffect(() => {
    setLocalSheet(null)
  }, [openAiToolOutput?.timestamp])

  const toolOutput = localSheet ?? openAiToolOutput ?? mcpToolOutput

  const [renderData, setRenderData] = React.useState<any>(null)

  // Audio element for pop sound
  const audioRef = React.useRef<HTMLAudioElement | null>(null)
  // Space-dust burst layer
  const particlesRef = React.useRef<PopParticlesHandle>(null)

  // Initialize audio element
  React.useEffect(() => {
    // Audio URL - served from MCP server
    // BASE_URL will be injected during build
    const audioUrl = "__BASE_URL__/assets/audio/pop.mp3"

    audioRef.current = new Audio(audioUrl)
    audioRef.current.preload = "auto"
    audioRef.current.volume = 0.5 // Set volume to 50%
  }, [])

  useEffect(() => {
    // Request render data when ready
    const requestRenderData = async () => {
      return new Promise((resolve, reject) => {
        const messageId = crypto.randomUUID()

        window.parent.postMessage(
          { type: "ui-request-render-data", messageId },
          "*"
        )

        const handleMessage = (event: MessageEvent) => {
          if (event.data?.type !== "ui-lifecycle-iframe-render-data") return
          if (event.data.messageId !== messageId) return

          window.removeEventListener("message", handleMessage)

          const { renderData, error } = event.data.payload
          if (error) return reject(error)
          return resolve(renderData)
        }

        window.addEventListener("message", handleMessage)
      })
    }

    // Use it when your iframe is ready
    requestRenderData()
      .then((data) => {
        console.log("👉 Render data:", data)
        setRenderData(data)
      })
      .catch((error) => {
        console.error("❌ Error requesting render data:", error)
      })
  }, [])

  const bubbleCount: number | undefined =
    toolOutput?.bubbleCount ??
    // While the MCP Apps tool call is still running we already know the input
    mcpToolInput?.bubbleCount ??
    // mcp-ui hosts (the /mcp route without ChatGPT) deliver initial render data
    renderData?.structuredContent?.bubbleCount

  // Initialize popped bubbles from widgetState if available
  const [poppedBubbles, setPoppedBubbles] = React.useState<Set<number>>(
    new Set()
  )
  const [hasInitialized, setHasInitialized] = React.useState(false)

  // Initialize from widgetState when it becomes available
  React.useEffect(() => {
    if (!hasInitialized && widgetState?.poppedBubbles) {
      console.log(
        "[BubbleWrap] Initializing from widgetState:",
        widgetState.poppedBubbles
      )
      setPoppedBubbles(new Set(widgetState.poppedBubbles))
      setHasInitialized(true)
    } else if (!hasInitialized && widgetState === null) {
      // Widget state is explicitly null, start fresh
      setHasInitialized(true)
    }
  }, [widgetState, hasInitialized])

  // Sync popped bubbles from widgetState when it changes (after initialization)
  React.useEffect(() => {
    if (hasInitialized && widgetState?.poppedBubbles) {
      const persistedSet = new Set(widgetState.poppedBubbles)
      setPoppedBubbles((current) => {
        // Only update if different to avoid unnecessary re-renders
        if (
          current.size !== persistedSet.size ||
          !Array.from(current).every((idx) => persistedSet.has(idx))
        ) {
          console.log(
            "[BubbleWrap] Syncing from widgetState:",
            widgetState.poppedBubbles
          )
          return persistedSet
        }
        return current
      })
    }
  }, [widgetState, hasInitialized])

  // Debug logging
  useEffect(() => {
    console.log("[BubbleWrap] Component rendered")
    console.log("[BubbleWrap] toolOutput:", toolOutput)
    console.log("[BubbleWrap] bubbleCount:", bubbleCount)
    console.log("[BubbleWrap] widgetState:", widgetState)
    console.log("[BubbleWrap] poppedBubbles:", Array.from(poppedBubbles))
  }, [toolOutput, bubbleCount, widgetState, poppedBubbles])

  // A fresh sheet arrives when the bubble count changes or when the tool is
  // called again (new timestamp, possibly with the same count). Either way,
  // reset the popped state and bump the sheet generation so the grid remounts
  // and the inflate animation plays again.
  const [sheetGeneration, setSheetGeneration] = React.useState(0)
  // Timing for the completion card: first pop to last pop on this sheet.
  const firstPopAtRef = React.useRef<number | null>(null)
  const [elapsedMs, setElapsedMs] = React.useState<number | null>(null)
  const sheetTimestamp = toolOutput?.timestamp
  const prevSheetRef = React.useRef({ bubbleCount, sheetTimestamp })
  React.useEffect(() => {
    const prev = prevSheetRef.current
    const countChanged =
      bubbleCount !== undefined &&
      prev.bubbleCount !== undefined &&
      bubbleCount !== prev.bubbleCount
    const timestampChanged =
      sheetTimestamp !== undefined &&
      prev.sheetTimestamp !== undefined &&
      sheetTimestamp !== prev.sheetTimestamp
    if (countChanged || timestampChanged) {
      console.log("[BubbleWrap] New bubble sheet, resetting state")
      firstPopAtRef.current = null
      setElapsedMs(null)
      setPoppedBubbles(new Set())
      setSheetGeneration((g) => g + 1)
      window.openai?.setWidgetState({ poppedBubbles: [] })
    }
    prevSheetRef.current = { bubbleCount, sheetTimestamp }
  }, [bubbleCount, sheetTimestamp])

  // Inflate sound, in step with the grid's inflate animation. The grid
  // remounts (and the animation restarts) whenever sheetGeneration changes, so
  // the sound follows the same trigger.
  const bubbleCountRef = React.useRef(bubbleCount)
  bubbleCountRef.current = bubbleCount
  const hasSheet = Boolean(bubbleCount)
  React.useEffect(() => {
    const count = bubbleCountRef.current
    if (!count) return
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return
    const sequence = playInflateSequence({
      count,
      stepMs: inflateStepMs(count),
      leadMs: INFLATE_SOUND_LEAD_MS,
    })
    return () => sequence.stop()
  }, [sheetGeneration, hasSheet])

  const handleBubblePop = async (index: number, target?: HTMLElement) => {
    const now = performance.now()
    if (firstPopAtRef.current === null) firstPopAtRef.current = now
    if (bubbleCount && poppedBubbles.size + 1 === bubbleCount) {
      setElapsedMs(now - firstPopAtRef.current)
    }

    // Space dust from the bubble's centre (viewport coordinates; the canvas is fixed)
    if (target) {
      const rect = target.getBoundingClientRect()
      particlesRef.current?.burst(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
        rect.width / 2
      )
    }

    // Play pop sound
    if (audioRef.current) {
      try {
        audioRef.current.currentTime = 0
        await audioRef.current.play()
      } catch (error) {
        // Silently handle autoplay restrictions or other errors
        console.error("[BubbleWrap] Error playing audio:", error)
      }
    }

    setPoppedBubbles((prev) => {
      const newSet = new Set(prev)
      newSet.add(index)
      // Persist state to widgetState
      const poppedArray = Array.from(newSet).sort((a, b) => a - b)
      console.log("[BubbleWrap] Persisting popped bubbles:", poppedArray)
      window.openai
        ?.setWidgetState({ poppedBubbles: poppedArray })
        .catch((error) => {
          console.error("[BubbleWrap] Error persisting widget state:", error)
        })
      return newSet
    })
  }

  const [creatingSheet, setCreatingSheet] = React.useState(false)

  // Fetch a fresh sheet from the server. Deliberately does not post anything
  // into the conversation: starting a new sheet is a UI-only action.
  const handleNewBubbleWrap = async (bubbleCountValue: number) => {
    setCreatingSheet(true)
    try {
      if (isOpenAiHost()) {
        const response = (await window.openai.callTool("bubble_wrap", {
          bubbleCount: bubbleCountValue,
        })) as unknown as { structuredContent?: BubbleWrapStructuredContent }
        console.log("Bubble wrap tool response:", response)
        const fresh = response?.structuredContent
        setLocalSheet(
          fresh?.bubbleCount
            ? fresh
            : {
                bubbleCount: bubbleCountValue,
                timestamp: new Date().toISOString(),
              }
        )
        return
      }

      if (!mcpApp.app) {
        console.warn("No host connection available to call bubble_wrap")
        return
      }

      const result = await mcpApp.app.callServerTool({
        name: "bubble_wrap",
        arguments: { bubbleCount: bubbleCountValue },
      })
      console.log("Bubble wrap tool response:", { result })
      // The host may not re-render for app-initiated calls, so apply it here.
      mcpApp.setToolResult(result)
    } catch (error) {
      console.error("Error creating new bubble wrap:", error)
    } finally {
      setCreatingSheet(false)
    }
  }

  // Finale: a ring of space-dust puffs around the completion card.
  const isComplete = Boolean(bubbleCount) && poppedBubbles.size === bubbleCount
  React.useEffect(() => {
    if (!isComplete) return
    const timers: number[] = []
    const cx = window.innerWidth / 2
    const cy = window.innerHeight / 2
    const spread = Math.min(window.innerWidth, window.innerHeight) * 0.32
    const puffs = 7
    for (let i = 0; i < puffs; i++) {
      const angle = (i / puffs) * Math.PI * 2 - Math.PI / 2
      timers.push(
        window.setTimeout(
          () =>
            particlesRef.current?.burst(
              cx + Math.cos(angle) * spread * 1.2,
              cy + Math.sin(angle) * spread,
              22
            ),
          180 + i * 70
        )
      )
    }
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [isComplete])

  useEffect(() => {
    window.parent.postMessage(
      {
        type: "ui-request-data",
        messageId: `get-bubble-count-${Date.now()}`,
        payload: {
          requestType: "get-bubble-count",
          params: {},
        },
      },
      "*"
    )
  }, [bubbleCount])

  // Size the grid to the container (and, outside inline mode, to the viewport)
  const viewport = useViewport()
  const gridContainerRef = React.useRef<HTMLDivElement>(null)
  const headerRef = React.useRef<HTMLDivElement>(null)
  const [headerHeight, setHeaderHeight] = React.useState(0)

  React.useEffect(() => {
    const el = headerRef.current
    if (!el) return
    const update = () => setHeaderHeight(el.offsetHeight)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [bubbleCount])

  // Top padding of the grid below the header (the header's own padding is
  // included in its measured height).
  const GRID_PADDING = 8
  const { columns, size, fitsViewport, availableHeight } = useBubbleLayout({
    bubbleCount: bubbleCount ?? 0,
    fitHeight: viewport.fixed,
    viewportHeight: viewport.height,
    containerRef: gridContainerRef,
    reservedHeight: headerHeight + GRID_PADDING + CONTROLS_RESERVE,
  })

  // Shifted odd rows only need a half-bubble of room when one reaches the last
  // column; otherwise reserving it would pull the clump off centre.
  const hasOddRows = needsHalfStep(bubbleCount ?? 0, columns)

  // In a fixed-height frame, when the sheet doesn't fill the viewport, push it down
  // so the clump sits at the vertical centre of the whole viewport (not just
  // the space under the header), without ever crowding the bottom controls.
  let gridOffset = 0
  if (fitsViewport && viewport.fixed && bubbleCount) {
    const height = gridHeight(bubbleCount, columns, size)
    const slack = Math.max(0, availableHeight - height)
    const centred =
      (availableHeight +
        CONTROLS_RESERVE -
        headerHeight -
        GRID_PADDING -
        height) /
      2
    gridOffset = Math.min(slack, Math.max(0, centred))
  }

  return (
    <Layout className="bw-root">
      {bubbleCount ? (
        <div
          className={`flex flex-col bw-fill ${isComplete ? "bw-fill-complete" : ""}`}
        >
          {/* Popped bubbles tracker */}
          <div
            ref={headerRef}
            className={`bw-blurrable sticky top-0 z-10 ${isComplete ? "bw-blurred" : ""}`}
            aria-hidden={isComplete || undefined}
            style={{
              padding: "var(--bw-pad) var(--bw-pad) calc(var(--bw-pad) * 0.5)",
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm bw-muted">Total Bubbles</p>
                <p className="text-3xl font-bold bw-strong">{bubbleCount}</p>
              </div>
              <div className="text-center">
                <p className="text-sm bw-muted">Popped</p>
                <p className="text-3xl font-bold bw-strong">
                  {poppedBubbles.size}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm bw-muted">Remaining</p>
                <p className="text-3xl font-bold bw-strong">
                  {bubbleCount - poppedBubbles.size}
                </p>
              </div>
            </div>
          </div>

          {/* Bubble wrap grid */}
          <div
            ref={gridContainerRef}
            className={`bw-blurrable flex-1 ${isComplete ? "bw-blurred" : ""}`}
            aria-hidden={isComplete || undefined}
            style={{
              padding: `${GRID_PADDING}px var(--bw-pad) ${CONTROLS_RESERVE}px`,
            }}
            data-fits-viewport={fitsViewport}
          >
            <div
              key={sheetGeneration}
              className="grid justify-center"
              style={{
                gridTemplateColumns: `repeat(${columns}, ${size}px)`,
                gap: BUBBLE_GAP,
                // Odd rows shift right by half a bubble; keep room for them so
                // the clump as a whole stays horizontally centred.
                paddingRight: hasOddRows ? size / 2 : 0,
                marginTop: gridOffset,
              }}
            >
              {Array.from({ length: bubbleCount }).map((_, index) => {
                const inflateStep = inflateStepMs(bubbleCount)
                const isPopped = poppedBubbles.has(index)
                const row = Math.floor(index / columns)
                const isOddRow = row % 2 === 1

                return (
                  <button
                    key={index}
                    onClick={(e) =>
                      !isPopped && handleBubblePop(index, e.currentTarget)
                    }
                    disabled={isPopped}
                    className={`bubble-button bw-inflate aspect-square transition-all duration-300 ease-out ${
                      isPopped
                        ? "popped opacity-60 cursor-not-allowed"
                        : "cursor-pointer"
                    }`}
                    style={{
                      transform: isOddRow ? "translateX(50%)" : undefined,
                      animationDelay: `${Math.round(index * inflateStep)}ms`,
                    }}
                    aria-label={
                      isPopped
                        ? `Bubble ${index + 1} popped`
                        : `Pop bubble ${index + 1}`
                    }
                  ></button>
                )
              })}
            </div>
          </div>

          {/* Display mode controls: one button per mode the host offers, fixed
              to the viewport bottom so they stay reachable while scrolling. */}
          <DisplayModeControls
            className={`bw-blurrable ${isComplete ? "bw-blurred" : ""}`}
          />

          {isComplete && (
            <CompletionCard
              key={sheetGeneration}
              bubbleCount={bubbleCount}
              elapsedMs={elapsedMs}
              onNewSheet={handleNewBubbleWrap}
              busy={creatingSheet}
            />
          )}

          <PopParticles ref={particlesRef} />
        </div>
      ) : (
        <div className="flex items-center justify-center min-h-[200px]">
          <p className="bw-muted animate-pulse">Waiting for bubble count...</p>
        </div>
      )}
    </Layout>
  )
}

export default BubbleWrap
