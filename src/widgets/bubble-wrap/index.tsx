import React from "react"
import { createRoot } from "react-dom/client"
import BubbleWrap from "./BubbleWrap"
import { McpAppProvider } from "../hooks/use-mcp-app"

const rootEl = document.getElementById("bubble-wrap-root")
if (rootEl) {
  createRoot(rootEl).render(
    <McpAppProvider>
      <BubbleWrap />
    </McpAppProvider>
  )
}

export { BubbleWrap }
export default BubbleWrap
