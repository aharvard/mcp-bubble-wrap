import React, { useEffect } from "react"
import { Layout } from "../components/Layout.js"
import { useOpenAiGlobal } from "../hooks/use-openai-global.js"
import type { BubbleWrapStructuredContent } from "./types.js"

// Add styles for pseudo-element
const bubbleStyles = `
  .bubble-button {
    position: relative;
  }
  .bubble-button::after {
    content: '';
    position: absolute;
    top: 3%;
    left: 3%;
    width: 90%;
    height: 90%;
    background: radial-gradient(circle at 24% 22%, rgb(255 255 255 / 96%) 7%, rgb(170 170 170 / 7%) 68%, transparent 100%);
    border-radius: 50%;
    pointer-events: none;
    z-index: 100;
  }
  .bubble-button.popped::after {
    content: '';
    position: absolute;
    top: 10%;
    left: 10%;
    width: 90%;
    height: 90%;
    background: radial-gradient(circle at 58% 63%, rgb(201 201 213 / 70%), rgb(255 255 255 / 11%) 93%, transparent 36%);
    border-radius: 50%;
    pointer-events: none;
    z-index: 100;
  }
`

interface WidgetState {
  poppedBubbles: number[]
}

export function BubbleWrap() {
  const toolOutput = useOpenAiGlobal(
    "toolOutput"
  ) as BubbleWrapStructuredContent
  const widgetState = useOpenAiGlobal("widgetState") as WidgetState | null

  const [renderData, setRenderData] = React.useState<any>(null)

  // Audio element for pop sound
  const audioRef = React.useRef<HTMLAudioElement | null>(null)

  // Initialize audio element
  React.useEffect(() => {
    // Audio URL - will be replaced with base64 data URL during build
    // This allows the audio to be self-contained in the widget HTML
    const audioUrl = "http://localhost:4444/audio/pop.mp3"

    audioRef.current = new Audio(audioUrl)
    audioRef.current.preload = "auto"
    audioRef.current.volume = 0.5 // Set volume to 50%
  }, [])

  useEffect(() => {
    console.log("✨Restaurants widget rendered")
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

  const bubbleCount =
    toolOutput?.bubbleCount ?? renderData?.structuredContent?.bubbleCount

  // Initialize popped bubbles from widgetState if available
  const [poppedBubbles, setPoppedBubbles] = React.useState<Set<number>>(
    new Set()
  )
  const [columns, setColumns] = React.useState(6)
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

  // Reset popped bubbles when bubble count changes
  const prevBubbleCountRef = React.useRef<number | undefined>(bubbleCount)
  React.useEffect(() => {
    if (
      bubbleCount !== undefined &&
      prevBubbleCountRef.current !== undefined &&
      bubbleCount !== prevBubbleCountRef.current
    ) {
      console.log("[BubbleWrap] Bubble count changed, resetting state")
      setPoppedBubbles(new Set())
      // Clear widget state when bubble count changes
      window.openai?.setWidgetState({ poppedBubbles: [] })
    }
    prevBubbleCountRef.current = bubbleCount
  }, [bubbleCount])

  const handleBubblePop = async (index: number) => {
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

  const handleNewBubbleWrap = async () => {
    try {
      const bubbleCountValue = 100 // Default bubble count
      // Call the bubble_wrap tool to create a new bubble wrap
      console.log("Calling bubble_wrap tool to create a new bubble wrap")
      const toolResponse = await window.openai?.callTool("bubble_wrap", {
        bubbleCount: bubbleCountValue,
      })
      console.log("Bubble wrap tool response:", { toolResponse })

      // Send a follow-up message with the bubble count
      const followUpResponse = await window.openai?.sendFollowUpMessage({
        prompt: `Created a new bubble wrap with ${bubbleCountValue} bubbles`,
      })
      console.log("Follow-up message response:", { followUpResponse })
    } catch (error) {
      console.error("Error creating new bubble wrap:", error)
    }
  }

  const handleFullscreen = async () => {
    try {
      await window.openai?.requestDisplayMode({ mode: "fullscreen" })
    } catch (error) {
      console.error("Error requesting fullscreen:", error)
    }
  }

  const handlePictureInPicture = async () => {
    try {
      await window.openai?.requestDisplayMode({ mode: "pip" })
    } catch (error) {
      console.error("Error requesting picture-in-picture:", error)
    }
  }

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

  // Update columns based on window size (matching Tailwind breakpoints)
  React.useEffect(() => {
    const updateColumns = () => {
      const width = window.innerWidth
      if (width >= 1024) {
        // lg breakpoint
        setColumns(12)
      } else if (width >= 768) {
        // md breakpoint
        setColumns(10)
      } else if (width >= 640) {
        // sm breakpoint
        setColumns(8)
      } else {
        setColumns(6)
      }
    }

    updateColumns()
    window.addEventListener("resize", updateColumns)
    return () => window.removeEventListener("resize", updateColumns)
  }, [])

  return (
    <Layout className="p-6">
      <style>{bubbleStyles}</style>

      {bubbleCount ? (
        <div className="bg-[#e0e0e0]">
          {/* Popped bubbles tracker */}
          <div className="sticky top-0 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Bubbles</p>
                <p className="text-3xl font-bold text-black">{bubbleCount}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600">Popped</p>
                <p className="text-3xl font-bold text-black">
                  {poppedBubbles.size}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Remaining</p>
                <p className="text-3xl font-bold text-black">
                  {bubbleCount - poppedBubbles.size}
                </p>
              </div>
            </div>
            {poppedBubbles.size === bubbleCount && (
              <div className="mt-3 p-2 text-center">
                <p className="text-sm font-semibold text-black mb-4">
                  All bubbles popped! Great job!
                </p>
                <button
                  className="bg-black text-white px-6 py-3 rounded-md hover:bg-gray-800 transition-colors"
                  onClick={handleNewBubbleWrap}
                >
                  New Bubble Wrap
                </button>
              </div>
            )}
          </div>

          {/* Bubble wrap grid */}
          <div className="relative p-4 pr-[calc(1rem+8.33%)] sm:pr-[calc(1rem+6.25%)] md:pr-[calc(1rem+5%)] lg:pr-[calc(1rem+4.17%)] pb-20 bg-[#e0e0e0]">
            {/* Display mode buttons */}
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center gap-3 z-50">
              {/* Picture-in-picture button */}
              <button
                onClick={handlePictureInPicture}
                className="w-8 h-8 bg-white/40 hover:bg-white shadow-md hover:shadow-lg rounded-full transition-all flex items-center justify-center border border-gray-200"
                aria-label="Enter picture-in-picture"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-4 h-4 text-gray-700"
                >
                  <rect x="2" y="2" width="16" height="12" rx="2" />
                  <rect x="14" y="14" width="8" height="8" rx="2" />
                </svg>
              </button>
              {/* Fullscreen button */}
              <button
                onClick={handleFullscreen}
                className="w-8 h-8 bg-white/40 hover:bg-white shadow-md hover:shadow-lg rounded-full transition-all flex items-center justify-center border border-gray-200"
                aria-label="Enter fullscreen"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-4 h-4 text-gray-700"
                >
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2">
              {Array.from({ length: bubbleCount }).map((_, index) => {
                const isPopped = poppedBubbles.has(index)
                // Calculate row based on current column count
                const row = Math.floor(index / columns)
                const isOddRow = row % 2 === 1

                return (
                  <button
                    key={index}
                    onClick={() => !isPopped && handleBubblePop(index)}
                    disabled={isPopped}
                    className={`
                      bubble-button aspect-square transition-all duration-300 ease-out
                      ${
                        isPopped
                          ? "popped opacity-60 cursor-not-allowed"
                          : "cursor-pointer"
                      }
                    `}
                    style={{
                      position: "relative",
                      borderRadius: "50%",
                      background: isPopped
                        ? "linear-gradient(145deg, #cacaca, #f0f0f0)"
                        : "linear-gradient(145deg, #f0f0f0, #cacaca)",
                      boxShadow: isPopped
                        ? "6px 6px 12px #cecece, -6px -6px 12px #f2f2f2"
                        : "12px 12px 24px #b3b3b3, -12px -12px 24px #ffffff",
                      transform: isOddRow
                        ? `translateX(50%) ${isPopped ? "" : ""}`
                        : isPopped
                          ? ""
                          : undefined,
                    }}
                    onMouseEnter={(e) => {
                      if (!isPopped) {
                        e.currentTarget.style.transform = isOddRow
                          ? "translateX(50%)"
                          : ""
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isPopped) {
                        e.currentTarget.style.transform = isOddRow
                          ? "translateX(50%)"
                          : ""
                      }
                    }}
                    onMouseDown={(e) => {
                      if (!isPopped) {
                        e.currentTarget.style.transform = isOddRow
                          ? "translateX(50%)"
                          : ""
                      }
                    }}
                    onMouseUp={(e) => {
                      if (!isPopped) {
                        e.currentTarget.style.transform = isOddRow
                          ? "translateX(50%)"
                          : ""
                      }
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
        </div>
      ) : (
        <div className="flex items-center justify-center min-h-[200px]">
          <p className="text-gray-500 animate-pulse">
            Waiting for bubble count...
          </p>
        </div>
      )}
    </Layout>
  )
}

export default BubbleWrap
