import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { createUIResource } from "@mcp-ui/server"
import { z } from "zod"
import { readFileSync } from "fs"
import { fileURLToPath } from "url"
import { dirname, join } from "path"
import {
  bubbleWrapOutputSchema,
  type BubbleWrapStructuredContent,
} from "./widgets/bubble-wrap/types.js"

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Template URI for Apps SDK
const BUBBLE_WRAP_TEMPLATE_URI = "ui://widgets/bubble-wrap"

// Determine base URL for assets (use environment variable or default to localhost)
const BASE_URL = process.env.BASE_URL || "http://localhost:4444"

// Widget HTML (loaded once on first use)
let widgetHtml: string | null = null

/**
 * Load the built widget HTML from the assets directory
 */
function loadWidgetHtml(): string {
  if (widgetHtml) {
    return widgetHtml
  }

  try {
    // Read the unhashed HTML file from assets directory
    // The build script generates bubble-wrap.html (unhashed for quick cache updates)
    const assetsDir = join(__dirname, "..", "assets")
    const htmlFile = "bubble-wrap.html"
    const assetsPath = join(assetsDir, htmlFile)

    widgetHtml = readFileSync(assetsPath, "utf-8")
    console.log("Loaded bubble-wrap HTML from:", htmlFile)
    return widgetHtml
  } catch (error) {
    // Fallback: if assets aren't built yet, return a dev-mode HTML
    console.error(
      "Widget assets not found, using dev mode HTML. Run 'npm run build:widgets' first.",
      error
    )
    return `<!doctype html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
  <p>Widget assets not found, using dev mode HTML. Run 'npm run build:widgets' first.</p>
</body>
</html>`
  }
}

export function initMcpServer(): McpServer {
  // Create a new server instance for this specific session.
  const server = new McpServer({
    name: "mcp-bubble-wrap",
    version: "1.0.0",
  })

  // Step 1: Register the Apps SDK template resource
  // This template is for ChatGPT (Apps SDK) and includes the adapter
  const appsSdkTemplate = createUIResource({
    uri: BUBBLE_WRAP_TEMPLATE_URI,
    encoding: "text",
    adapters: {
      appsSdk: {
        enabled: true,
        config: { intentHandling: "prompt" },
      },
    },
    content: {
      type: "rawHtml",
      htmlString: loadWidgetHtml(),
    },
    metadata: {
      "openai/widgetDescription":
        "An interactive bubble wrap simulator where you can pop virtual bubbles for stress relief",
      "openai/widgetPrefersBorder": true,
      // we don't technically need to set domains to BASE_URL since we are inlining JS and CSS in the HTML
      // however, I'm leaving this in as an example of how to set CSP domains
      // we likely need to provide domains for fonts at some point
      "openai/widgetCSP": {
        connect_domains: [BASE_URL],
        resource_domains: [BASE_URL],
      },
      "dev/widgetHtml": widgetHtml,
    },
  })

  // Register the template as a resource
  server.registerResource(
    "bubble-wrap-template",
    BUBBLE_WRAP_TEMPLATE_URI,
    {
      title: "Bubble Wrap Template",
      description: "Template for Apps SDK",
      mimeType: "text/html",
    },
    async (uri) => ({
      contents: [appsSdkTemplate.resource],
    })
  )

  // Step 2 & 3: Register the tool with Apps SDK metadata and embedded UI resources
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
        "openai/outputTemplate": BUBBLE_WRAP_TEMPLATE_URI,
        "openai/toolInvocation/invoking": "Unrolling bubble wrap...",
        "openai/toolInvocation/invoked": "Bubble wrap unrolled, get popping!",
        "openai/widgetAccessible": true,
      },
    },
    async ({ bubbleCount = 100 }: { bubbleCount?: number }) => {
      // Validate bubble count
      if (bubbleCount < 1 || bubbleCount > 500) {
        throw new Error("Bubble count must be between 1 and 500")
      }
      // Validate and clamp bubble count
      const validBubbleCount = Math.min(
        Math.max(Math.floor(bubbleCount), 1),
        500
      )

      // Create MCP-UI embedded resource (without Apps SDK adapter)
      // This is for MCP-native hosts
      const uiResource = createUIResource({
        uri: `ui://widgets/bubble-wrap/${validBubbleCount}`,
        encoding: "text",
        content: {
          type: "rawHtml",
          htmlString: loadWidgetHtml(),
        },
      })

      // Return both text content and the UI resource
      const structuredContent: BubbleWrapStructuredContent = {
        bubbleCount: validBubbleCount,
      }

      return {
        content: [
          {
            type: "text",
            text: `Created a bubble wrap simulator with ${validBubbleCount} bubbles. Click to pop them all!`,
          },
          uiResource,
        ],
        // Structured content for Apps SDK - type-safe!
        structuredContent,
      }
    }
  )

  return server
}
