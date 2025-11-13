import React, { useEffect, useState } from "react"
import { Layout } from "../components/Layout.js"
import { useOpenAiGlobal } from "../hooks/use-openai-global.js"
import type { PackingSlipStructuredContent } from "./types.js"

export function PackingSlip() {
  const toolOutput = useOpenAiGlobal(
    "toolOutput"
  ) as PackingSlipStructuredContent

  const [platformInfo, setPlatformInfo] = useState({
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    colorDepth: window.screen.colorDepth,
    pixelRatio: window.devicePixelRatio,
    online: navigator.onLine,
    cookiesEnabled: navigator.cookieEnabled,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  })

  const [messageCount, setMessageCount] = useState(0)

  // Debug logging
  useEffect(() => {
    console.log("[PackingSlip] Component rendered")
    console.log("[PackingSlip] toolOutput:", toolOutput)
  }, [toolOutput])

  // Update viewport dimensions on resize
  useEffect(() => {
    const handleResize = () => {
      setPlatformInfo((prev) => ({
        ...prev,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      }))
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  // Test message to parent
  const sendTestMessage = () => {
    const msg = {
      type: "ui-request-data",
      messageId: `test-message-${Date.now()}`,
      payload: {
        requestType: "test-platform-feature",
        params: { count: messageCount },
      },
    }
    console.log("[PackingSlip] Sending test message:", msg)
    window.parent.postMessage(msg, "*")
    setMessageCount((prev) => prev + 1)
  }

  // Listen for messages from parent
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      console.log("[PackingSlip] Received message from parent:", event.data)
    }

    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [])

  return (
    <Layout className="p-4">
      <div className="font-mono text-xs bg-gray-50 border border-gray-300 rounded">
        {/* Header */}
        <div className="bg-gray-800 text-white px-3 py-2 font-bold">
          PACKING SLIP - PLATFORM TEST WIDGET
        </div>

        {/* Tool Output Section */}
        <div className="border-b border-gray-300 p-3">
          <div className="font-bold mb-2 text-gray-700">TOOL OUTPUT:</div>
          <div className="bg-white p-2 border border-gray-200 rounded">
            <div className="text-gray-600">
              Timestamp: {toolOutput?.timestamp || "N/A"}
            </div>
          </div>
        </div>

        {/* Platform Info Section */}
        <div className="border-b border-gray-300 p-3">
          <div className="font-bold mb-2 text-gray-700">PLATFORM INFO:</div>
          <div className="bg-white p-2 border border-gray-200 rounded space-y-1">
            {Object.entries(platformInfo).map(([key, value]) => (
              <div key={key} className="flex justify-between text-gray-600">
                <span className="font-semibold">{key}:</span>
                <span className="text-right ml-2 break-all max-w-xs">
                  {String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Interaction Tests Section */}
        <div className="border-b border-gray-300 p-3">
          <div className="font-bold mb-2 text-gray-700">INTERACTION TESTS:</div>
          <div className="space-y-2">
            <button
              onClick={sendTestMessage}
              className="w-full bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 active:bg-blue-800 transition-colors font-bold"
            >
              SEND TEST MESSAGE ({messageCount} sent)
            </button>
            <button
              onClick={() => console.log("[PackingSlip] Console test")}
              className="w-full bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 active:bg-green-800 transition-colors font-bold"
            >
              LOG TO CONSOLE
            </button>
            <button
              onClick={() => alert("Test alert from PackingSlip widget")}
              className="w-full bg-yellow-600 text-white px-3 py-2 rounded hover:bg-yellow-700 active:bg-yellow-800 transition-colors font-bold"
            >
              TEST ALERT
            </button>
          </div>
        </div>

        {/* Storage Tests Section */}
        <div className="border-b border-gray-300 p-3">
          <div className="font-bold mb-2 text-gray-700">STORAGE TESTS:</div>
          <div className="space-y-2">
            <button
              onClick={() => {
                try {
                  localStorage.setItem("test-key", Date.now().toString())
                  console.log(
                    "[PackingSlip] localStorage write successful:",
                    localStorage.getItem("test-key")
                  )
                } catch (e) {
                  console.error("[PackingSlip] localStorage error:", e)
                }
              }}
              className="w-full bg-purple-600 text-white px-3 py-2 rounded hover:bg-purple-700 active:bg-purple-800 transition-colors font-bold"
            >
              TEST LOCALSTORAGE
            </button>
            <button
              onClick={() => {
                try {
                  sessionStorage.setItem("test-key", Date.now().toString())
                  console.log(
                    "[PackingSlip] sessionStorage write successful:",
                    sessionStorage.getItem("test-key")
                  )
                } catch (e) {
                  console.error("[PackingSlip] sessionStorage error:", e)
                }
              }}
              className="w-full bg-indigo-600 text-white px-3 py-2 rounded hover:bg-indigo-700 active:bg-indigo-800 transition-colors font-bold"
            >
              TEST SESSIONSTORAGE
            </button>
          </div>
        </div>

        {/* Raw Tool Output Debug */}
        <div className="p-3">
          <div className="font-bold mb-2 text-gray-700">RAW TOOL OUTPUT:</div>
          <div className="bg-black text-green-400 p-2 rounded overflow-auto max-h-32">
            <pre className="text-xs">
              {JSON.stringify(toolOutput, null, 2) || "null"}
            </pre>
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default PackingSlip
