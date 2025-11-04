import React, { useState, useEffect, useRef } from "react"
// import { motion, AnimatePresence } from "framer-motion"
import { WidgetWrapper } from "../components/WidgetWrapper.js"
import { useOpenAiGlobal } from "../hooks/use-openai-global.js"
import type { BubbleWrapStructuredContent } from "./types.js"

export function BubbleWrap() {
  // Get the structured content from the tool output with type safety
  const toolOutput = useOpenAiGlobal(
    "toolOutput"
  ) as BubbleWrapStructuredContent | null
  const bubbleCount = toolOutput?.bubbleCount ?? 100
  // const popBubble = (id: number) => {
  //   setBubbles((prev) => {
  //     const bubble = prev.find((b) => b.id === id)
  //     if (!bubble || bubble.popped) return prev

  //     return prev.map((b) => (b.id === id ? { ...b, popped: true } : b))
  //   })
  //   setPoppedCount((prev) => prev + 1)
  // }

  // const resetBubbles = () => {
  //   setBubbles((prev) => prev.map((b) => ({ ...b, popped: false })))
  //   setPoppedCount(0)
  // }

  return (
    <WidgetWrapper applyMaxHeight={true}>
      <div className="bubble-wrap-container">
        <div className="header">
          <h1>🫧 Bubble Wrap Simulator 🫧</h1>
          <p>Click to pop!</p>
          <p>Bubble count: {bubbleCount}</p>
        </div>

        {/* <div className="stats">
          Popped: <span className="count">{poppedCount}</span> / {bubbleCount}
        </div>

        <div className="bubble-grid">
          {bubbles.map((bubble) => (
            <motion.div
              key={bubble.id}
              className={`bubble ${bubble.popped ? "popped" : ""}`}
              onClick={() => popBubble(bubble.id)}
              whileHover={!bubble.popped ? { scale: 1.1 } : {}}
              whileTap={!bubble.popped ? { scale: 0.95 } : {}}
              animate={
                bubble.popped
                  ? {
                      scale: [1, 1.3, 1],
                      transition: { duration: 0.3 },
                    }
                  : {}
              }
            />
          ))}
        </div>

        <button className="reset-btn" onClick={resetBubbles}>
          Reset All Bubbles
        </button> */}
      </div>
    </WidgetWrapper>
  )
}

export default BubbleWrap
