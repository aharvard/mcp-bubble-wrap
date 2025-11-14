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

export function BubbleWrap() {
  const toolOutput = useOpenAiGlobal(
    "toolOutput"
  ) as BubbleWrapStructuredContent

  const [renderData, setRenderData] = React.useState<any>(null)

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
  const [poppedBubbles, setPoppedBubbles] = React.useState<Set<number>>(
    new Set()
  )
  const [columns, setColumns] = React.useState(6)

  // Debug logging
  useEffect(() => {
    console.log("[BubbleWrap] Component rendered")
    console.log("[BubbleWrap] toolOutput:", toolOutput)
    console.log("[BubbleWrap] bubbleCount:", bubbleCount)
  }, [toolOutput, bubbleCount])

  // Reset popped bubbles when bubble count changes
  React.useEffect(() => {
    setPoppedBubbles(new Set())
  }, [bubbleCount])

  const handleBubblePop = (index: number) => {
    setPoppedBubbles((prev) => {
      const newSet = new Set(prev)
      newSet.add(index)
      return newSet
    })
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
              <div className="mt-3 p-2  text-center">
                <p className="text-sm font-semibold text-black">
                  All bubbles popped! Great job!
                </p>
              </div>
            )}
          </div>

          {/* Bubble wrap grid */}
          <div className="relative p-4 pr-[calc(1rem+8.33%)] sm:pr-[calc(1rem+6.25%)] md:pr-[calc(1rem+5%)] lg:pr-[calc(1rem+4.17%)] bg-[#e0e0e0]">
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
