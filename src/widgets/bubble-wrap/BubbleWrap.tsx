import React from "react"
import { Layout } from "../components/Layout.js"
import { useOpenAiGlobal } from "../hooks/use-openai-global.js"
import type { BubbleWrapStructuredContent } from "./types.js"

export function BubbleWrap() {
  const toolOutput = useOpenAiGlobal(
    "toolOutput"
  ) as BubbleWrapStructuredContent

  const bubbleCount = toolOutput?.bubbleCount

  // Debug logging
  React.useEffect(() => {
    console.log("[BubbleWrap] Component rendered")
    console.log("[BubbleWrap] toolOutput:", toolOutput)
    console.log("[BubbleWrap] bubbleCount:", bubbleCount)
  }, [toolOutput, bubbleCount])

  return (
    <Layout className="p-6">
      {bubbleCount ? (
        <div className="text-center">
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-2">
            Bubble count: {bubbleCount}
          </p>
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              You've popped {bubbleCount} bubble{bubbleCount !== 1 ? "s" : ""}!
            </p>
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
