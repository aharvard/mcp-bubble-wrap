import React from "react"
import { createRoot } from "react-dom/client"
import BubbleWrap from "./BubbleWrap"

const rootEl = document.getElementById("bubble-wrap-root")
if (rootEl) {
  createRoot(rootEl).render(<BubbleWrap />)
}

export { BubbleWrap }
export default BubbleWrap
