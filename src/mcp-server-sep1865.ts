/**
 * MCP Server implementation using SEP-1865 (MCP Apps) specification.
 *
 * This server uses native MCP SDK patterns without the @mcp-ui/server adapter.
 * It's designed for clients that support the MCP Apps extension (io.modelcontextprotocol/ui).
 *
 * Route: /mcp-app
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import {
  bubbleWrapOutputSchema,
  type BubbleWrapStructuredContent,
} from "./widgets/bubble-wrap/types.js"
import {
  MCP_APPS_EXTENSION_ID,
  MCP_APPS_MIME_TYPE,
  clientSupportsMcpApps,
  getMcpAppsCapabilityLocation,
  type ClientCapabilitiesWithMcpApps,
} from "./types/mcp-apps.js"
import { loadWidgetHtml } from "./utils/load-widget-html.js"

const BASE_URL = process.env.BASE_URL || "http://localhost:5678"

export function initMcpServerSep1865(): McpServer {
  console.log(`\n🚀 Initializing MCP server (SEP-1865 mode)`)
  console.log(`   Extension ID: ${MCP_APPS_EXTENSION_ID}`)
  console.log(`   MIME Type: ${MCP_APPS_MIME_TYPE}`)

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

  server.registerResource(
    "bubble-wrap-app",
    "ui://widgets/bubble-wrap",
    {
      title: "Bubble Wrap App",
      description:
        "Interactive bubble wrap simulator - pop virtual bubbles for stress relief",
      mimeType: MCP_APPS_MIME_TYPE,
    },
    async () => ({
      contents: [
        {
          uri: "ui://widgets/bubble-wrap",
          mimeType: MCP_APPS_MIME_TYPE,
          text: loadWidgetHtml("bubble-wrap"),
          _meta: {
            ui: {
              prefersBorder: true,
              csp: {
                resourceDomains: [BASE_URL],
              },
            },
          },
        },
      ],
    })
  )

  // ==========================================================================
  // Tools - Register immediately (always available)
  // ==========================================================================
  // Note: Tools always include UI metadata. Clients that don't support
  // MCP Apps will ignore the _meta["ui/resourceUri"] field.
  // The tool always returns meaningful text content as fallback.

  server.registerTool(
    "mcp_app_demo",
    {
      title: "MCP App Demo",
      description:
        "A demonstration tool that showcases MCP app capabilities with multiple inputs and text output.",
      inputSchema: {
        name: z.string().describe("Your name or identifier"),
        message: z.string().describe("A message to include in the demo output"),
        count: z.number().describe("A number to include in the response"),
      },
    },
    async (args) => {
      const name = (args.name as string) ?? "User"
      const message = (args.message as string) ?? "Hello from MCP!"
      const count = (args.count as number) ?? 0

      const outputText = `MCP App Demo Results

Hello, ${name}!

Your message: "${message}"
${count > 0 ? `Count value: ${count}` : ""}

This is a demonstration of an MCP tool with multiple inputs and text output.
The tool successfully processed your inputs and generated this response.`

      return {
        content: [
          {
            type: "text",
            text: outputText,
          },
        ],
        structuredContent: {
          name,
          message,
          count,
        },
      }
    }
  )

  server.registerTool(
    "bubble_wrap",
    {
      title: "Bubble Wrap Simulator",
      description:
        "Creates an interactive bubble wrap popping simulator. Specify the number of bubbles to create (default: 100, max: 500).",
      inputSchema: {
        bubbleCount: z
          .number()
          .describe("Number of bubbles to create (default: 100, max: 500)"),
      },
      outputSchema: bubbleWrapOutputSchema.shape,
      _meta: {
        "ui/resourceUri": "ui://widgets/bubble-wrap",
      },
    },
    async (args) => {
      const bubbleCount = (args.bubbleCount as number) ?? 100

      if (bubbleCount < 1 || bubbleCount > 500) {
        throw new Error("Bubble count must be between 1 and 500")
      }
      const validBubbleCount = Math.min(
        Math.max(Math.floor(bubbleCount), 1),
        500
      )

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
    const clientCapabilities = server.server.getClientCapabilities() as
      | ClientCapabilitiesWithMcpApps
      | undefined

    const supportsMcpApps = clientSupportsMcpApps(clientCapabilities)
    const capabilityLocation = getMcpAppsCapabilityLocation(clientCapabilities)

    console.log(`\n🔍 Client capabilities (SEP-1865 server):`)

    if (supportsMcpApps) {
      const locationLabel =
        capabilityLocation === "experimental"
          ? " (advertised under experimental)"
          : ""
      console.log(`   ✅ MCP Apps: Supported${locationLabel}`)
      const capData =
        capabilityLocation === "experimental"
          ? clientCapabilities?.experimental?.[MCP_APPS_EXTENSION_ID]
          : clientCapabilities?.extensions?.[MCP_APPS_EXTENSION_ID]
      console.log(`      Extension: ${MCP_APPS_EXTENSION_ID}`, capData)
    } else {
      console.log(`   ℹ️  MCP Apps: Not advertised by client`)
      console.log(
        `      Note: UI may still work if client supports it without advertising.`
      )
      console.log(
        `      Tools include UI metadata regardless (graceful degradation).`
      )
    }

    // Log other capabilities (exclude extensions/experimental if MCP Apps is found there)
    const otherCaps = Object.keys(clientCapabilities ?? {}).filter((k) => {
      if (k === "extensions" || k === "experimental") {
        return false
      }
      return true
    })
    if (otherCaps.length > 0) {
      console.log(`   Other capabilities: ${otherCaps.join(", ")}`)
    }
  }

  return server
}
