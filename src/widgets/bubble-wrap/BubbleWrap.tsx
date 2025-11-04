import React, { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useWidgetProps } from "../hooks/use-widget-props.js"

interface BubbleWrapProps extends Record<string, unknown> {
  bubbleCount?: number
}

interface BubbleState {
  id: number
  popped: boolean
}

interface StructuredContent {
  [key: string]: any
}

export function BubbleWrap() {
  const props = useWidgetProps<BubbleWrapProps>({ bubbleCount: 100 })
  const bubbleCount = props?.bubbleCount || 100

  const [bubbles, setBubbles] = useState<BubbleState[]>([])
  const [poppedCount, setPoppedCount] = useState(0)

  useEffect(() => {
    // Inject data from OpenAI globals
    const toolOutput = (window as any).openai?.toolOutput as
      | StructuredContent
      | null
      | undefined

    // @ts-ignore
    if (window.openai) {
      // @ts-ignore
      console.log("OpenAI global:", window.openai)
    } else {
      console.log("No OpenAI global found")
    }

    if (toolOutput) {
      console.log("Received toolOutput data:", toolOutput)

      // You can access specific properties from toolOutput here
      // For example, if toolOutput has bubbleCount:
      if (toolOutput.bubbleCount) {
        console.log(
          "Custom bubble count from toolOutput:",
          toolOutput.bubbleCount
        )
      } else {
        console.log("No bubble count from toolOutput")
      }
    } else {
      console.log("No toolOutput data available")
    }

    // Initialize bubbles
    const initialBubbles = Array.from({ length: bubbleCount }, (_, i) => ({
      id: i,
      popped: false,
    }))
    setBubbles(initialBubbles)
    setPoppedCount(0)
  }, [bubbleCount])

  const popBubble = (id: number) => {
    setBubbles((prev) => {
      const bubble = prev.find((b) => b.id === id)
      if (!bubble || bubble.popped) return prev

      return prev.map((b) => (b.id === id ? { ...b, popped: true } : b))
    })
    setPoppedCount((prev) => prev + 1)
  }

  const resetBubbles = () => {
    setBubbles((prev) => prev.map((b) => ({ ...b, popped: false })))
    setPoppedCount(0)
  }

  return (
    <div className="bubble-wrap-container">
      <div className="header">
        <h1>🫧 Bubble Wrap Simulator 🫧</h1>
        <p>Click to pop!</p>
      </div>

      <div className="stats">
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
      </button>
    </div>
  )
}

export default BubbleWrap
