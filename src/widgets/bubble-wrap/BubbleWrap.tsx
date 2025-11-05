import React from "react"
import { WidgetWrapper } from "../components/WidgetWrapper.js"
import { useOpenAiGlobal } from "../hooks/use-openai-global.js"
import type { BubbleWrapStructuredContent } from "./types.js"

export function BubbleWrap() {
  const toolOutput = useOpenAiGlobal(
    "toolOutput"
  ) as BubbleWrapStructuredContent

  const bubbleCount = toolOutput?.bubbleCount

  return (
    <WidgetWrapper>
      {bubbleCount ? (
        <p>Bubble count: {bubbleCount}</p>
      ) : (
        <p>Waiting for bubble count...</p>
      )}
    </WidgetWrapper>
  )
}

export default BubbleWrap
