/**
 * MCP Server implementation using the MCP Apps extension (SEP-1865).
 *
 * This server uses the official `@modelcontextprotocol/ext-apps` server helpers
 * on top of the MCP TypeScript SDK v2. It's designed for clients that support
 * the MCP Apps extension (io.modelcontextprotocol/ui), such as Goose.
 *
 * Route: /mcp-app
 */

import { McpServer } from "@modelcontextprotocol/server"
import {
  EXTENSION_ID,
  RESOURCE_MIME_TYPE,
  getUiCapability,
  registerAppResource,
  registerAppTool,
} from "@modelcontextprotocol/ext-apps/server"
import type { McpUiResourceMeta } from "@modelcontextprotocol/ext-apps"
import { z } from "zod"
import {
  bubbleWrapOutputSchema,
  type BubbleWrapStructuredContent,
} from "./widgets/bubble-wrap/types.js"
import { SUPPORTED_DISPLAY_MODES } from "./shared/display-modes.js"
import { loadWidgetHtml } from "./utils/load-widget-html.js"

const BASE_URL = process.env.BASE_URL || "http://localhost:5678"

const BUBBLE_WRAP_APP_URI = "ui://widgets/bubble-wrap-app"

/**
 * UI resource metadata (`_meta.ui`) per the MCP Apps spec.
 *
 * Display modes are NOT declared here: the spec has the app itself advertise
 * `availableDisplayModes` in its `ui/initialize` capabilities. See
 * `src/shared/display-modes.ts` and `src/widgets/hooks/use-mcp-app.ts`.
 */
const bubbleWrapResourceMeta: McpUiResourceMeta = {
  // The app paints its own full-bleed background, so a host border only adds
  // a visible frame around it.
  prefersBorder: false,
  csp: {
    // Audio files (and any other static assets) are served from the MCP server.
    resourceDomains: [BASE_URL],
    connectDomains: [BASE_URL],
  },
}

export function initMcpAppServer(): McpServer {
  console.log(`\n🚀 Initializing MCP server (MCP Apps mode)`)
  console.log(`   Extension ID: ${EXTENSION_ID}`)
  console.log(`   MIME Type: ${RESOURCE_MIME_TYPE}`)
  console.log(`   Display modes: ${SUPPORTED_DISPLAY_MODES.join(", ")}`)

  const server = new McpServer(
    {
      name: "mcp-bubble-wrap-sep1865",
      version: "1.0.0",
      icons: [
        {
          src: `${BASE_URL}/assets/bubble-wrap-app-icon.svg`,
          mimeType: "image/svg+xml",
          sizes: ["any"],
        },
      ],
    },
    {
      // Enable logging capability so clients can call logging/setLevel
      capabilities: {
        logging: {},
      },
    }
  )

  // ==========================================================================
  // Resources - Register immediately (always available)
  // ==========================================================================
  // Note: UI resources are always registered. Clients that don't support
  // MCP Apps will simply ignore them (graceful degradation per SEP-1865).

  registerAppResource(
    server,
    "bubble-wrap-app",
    BUBBLE_WRAP_APP_URI,
    {
      title: "Bubble Wrap App",
      description:
        "Interactive bubble wrap simulator - pop virtual bubbles for stress relief",
      mimeType: RESOURCE_MIME_TYPE,
      _meta: { ui: bubbleWrapResourceMeta },
    },
    async () => ({
      contents: [
        {
          uri: BUBBLE_WRAP_APP_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: loadWidgetHtml("bubble-wrap"),
          _meta: { ui: bubbleWrapResourceMeta },
        },
      ],
    })
  )

  // ==========================================================================
  // Tools - Register immediately (always available)
  // ==========================================================================
  // Note: Tools always include UI metadata. Clients that don't support
  // MCP Apps will ignore the `_meta.ui` / `_meta["ui/resourceUri"]` fields
  // (registerAppTool emits both forms). The tool always returns meaningful
  // text content as a fallback.

  registerAppTool(
    server,
    "bubble_wrap",
    {
      title: "Bubble Wrap Simulator",
      description:
        "Creates an interactive bubble wrap popping simulator. Specify the number of bubbles to create (default: 100, max: 500).",
      inputSchema: z.object({
        bubbleCount: z
          .number()
          .describe("Number of bubbles to create (default: 100, max: 500)"),
      }),
      outputSchema: bubbleWrapOutputSchema,
      _meta: {
        ui: {
          resourceUri: BUBBLE_WRAP_APP_URI,
          // Callable both by the model and by the app itself ("New Bubble Wrap" button).
          visibility: ["model", "app"],
        },
      },
    },
    async ({ bubbleCount }) => {
      const requested = bubbleCount ?? 100

      if (requested < 1 || requested > 500) {
        throw new Error("Bubble count must be between 1 and 500")
      }
      const validBubbleCount = Math.min(Math.max(Math.floor(requested), 1), 500)

      const structuredContent: BubbleWrapStructuredContent = {
        bubbleCount: validBubbleCount,
        timestamp: new Date().toISOString(),
      }

      return {
        content: [
          {
            type: "text",
            text: `Created a bubble wrap simulator with ${validBubbleCount} bubbles. Click to pop them all!`,
          },
        ],
        structuredContent,
      }
    }
  )

  // ==========================================================================
  // Capability Logging (for debugging)
  // ==========================================================================
  // Log client capabilities after initialization completes

  server.server.oninitialized = () => {
    const clientCapabilities = server.server.getClientCapabilities()
    const uiCapability = getUiCapability(clientCapabilities)

    console.log(`\n🔍 Client capabilities (MCP Apps server):`)

    if (uiCapability) {
      console.log(`   ✅ MCP Apps: Supported`)
      console.log(`      Extension: ${EXTENSION_ID}`, uiCapability)
    } else {
      console.log(`   ℹ️  MCP Apps: Not advertised by client`)
      console.log(
        `      Note: UI may still work if client supports it without advertising.`
      )
      console.log(
        `      Tools include UI metadata regardless (graceful degradation).`
      )
    }

    const otherCaps = Object.keys(clientCapabilities ?? {}).filter(
      (k) => k !== "extensions"
    )
    if (otherCaps.length > 0) {
      console.log(`   Other capabilities: ${otherCaps.join(", ")}`)
    }
  }

  return server
}
