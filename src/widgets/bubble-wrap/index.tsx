import React from "react"
import { createRoot } from "react-dom/client"
import BubbleWrap from "./BubbleWrap"
import "./styles.css"

const rootEl = document.getElementById("bubble-wrap-root")
if (rootEl) {
  createRoot(rootEl).render(<BubbleWrap />)
}

export { BubbleWrap }
export default BubbleWrap
