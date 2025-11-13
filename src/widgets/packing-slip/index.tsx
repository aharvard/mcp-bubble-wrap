import React from "react"
import { createRoot } from "react-dom/client"
import PackingSlip from "./PackingSlip"

const rootEl = document.getElementById("packing-slip-root")
if (rootEl) {
  createRoot(rootEl).render(<PackingSlip />)
}

export { PackingSlip }
export default PackingSlip
