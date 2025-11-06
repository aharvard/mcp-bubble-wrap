import React, { useEffect } from "react"
import { Layout } from "../components/Layout.js"
import { useOpenAiGlobal } from "../hooks/use-openai-global.js"
import type { BubbleWrapStructuredContent } from "./types.js"

export function BubbleWrap() {
  const toolOutput = useOpenAiGlobal(
    "toolOutput"
  ) as BubbleWrapStructuredContent

  const bubbleCount = toolOutput?.bubbleCount
  const [poppedBubbles, setPoppedBubbles] = React.useState<Set<number>>(
    new Set()
  )

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

  return (
    <Layout className="p-6">
      {bubbleCount ? (
        <div className="space-y-6">
          {/* Popped bubbles tracker */}
          <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Total Bubbles
                </p>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {bubbleCount}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Popped
                </p>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {poppedBubbles.size}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Remaining
                </p>
                <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                  {bubbleCount - poppedBubbles.size}
                </p>
              </div>
            </div>
            {poppedBubbles.size === bubbleCount && (
              <div className="mt-3 p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded text-center">
                <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">
                  🎉 All bubbles popped! Great job!
                </p>
              </div>
            )}
          </div>

          {/* Bubble wrap grid */}
          <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
            {Array.from({ length: bubbleCount }).map((_, index) => {
              const isPopped = poppedBubbles.has(index)
              return (
                <button
                  key={index}
                  onClick={() => !isPopped && handleBubblePop(index)}
                  disabled={isPopped}
                  className={`
                    aspect-square rounded-full transition-all duration-300 ease-out
                    ${
                      isPopped
                        ? "bg-transparent border-2 border-dashed border-gray-300 dark:border-gray-600 scale-75 opacity-40 cursor-not-allowed"
                        : "bg-gradient-to-br from-blue-400 to-blue-600 dark:from-blue-500 dark:to-blue-700 shadow-lg hover:scale-110 hover:shadow-xl active:scale-95 cursor-pointer"
                    }
                    ${!isPopped && "hover:from-blue-500 hover:to-blue-700 dark:hover:from-blue-600 dark:hover:to-blue-800"}
                  `}
                  style={{
                    boxShadow: isPopped
                      ? "none"
                      : "0 4px 6px -1px rgba(59, 130, 246, 0.3), inset 0 2px 4px 0 rgba(255, 255, 255, 0.4)",
                  }}
                  aria-label={
                    isPopped
                      ? `Bubble ${index + 1} popped`
                      : `Pop bubble ${index + 1}`
                  }
                >
                  {!isPopped && (
                    <span className="block w-full h-full rounded-full bg-gradient-to-br from-white/30 to-transparent" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center min-h-[200px]">
          <p className="text-gray-500 dark:text-gray-400 animate-pulse">
            Waiting for bubble count...
          </p>
        </div>
      )}
    </Layout>
  )
}

export default BubbleWrap
