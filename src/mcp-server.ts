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

// Load manifest for hashed widget files
let manifest: {
  hash: string
  widgets: Array<{ name: string; htmlPath: string }>
} | null = null

function loadManifest() {
  if (manifest) return manifest
  try {
    const assetsDir = join(__dirname, "..", "assets")
    const manifestPath = join(assetsDir, "manifest.json")
    manifest = JSON.parse(readFileSync(manifestPath, "utf-8"))
    return manifest
  } catch (error) {
    console.error("Failed to load manifest:", error)
    return null
  }
}

// Load manifest early to get hash for template URIs
const loadedManifest = loadManifest()

// Get hash from manifest or use fallback
const widgetHash = loadedManifest?.hash || "unknown"

// Template URIs for Apps SDK
const BUBBLE_WRAP_TEMPLATE_URI = "ui://widgets/bubble-wrap"

// Determine base URL for assets (use environment variable or default to MCP server port)
// Audio files are served from the MCP server at /assets/audio/
const BASE_URL = process.env.BASE_URL || "http://localhost:5678"

// Widget HTML cache (loaded once on first use)
let bubbleWrapWidgetHtml: string | null = null

/**
 * Load the built widget HTML from the assets directory
 */
function loadWidgetHtml(widgetName: string): string {
  // Check cache
  if (widgetName === "bubble-wrap" && bubbleWrapWidgetHtml) {
    return bubbleWrapWidgetHtml
  }

  try {
    const assetsDir = join(__dirname, "..", "assets")
    let htmlFile: string

    // For widgets with hashes, use the manifest
    const manifest = loadManifest()
    const widgetEntry = manifest?.widgets.find((w) => w.name === widgetName)

    if (widgetEntry) {
      htmlFile = widgetEntry.htmlPath
    } else {
      // Fallback to unhashed name
      htmlFile = `${widgetName}.html`
    }

    const assetsPath = join(assetsDir, htmlFile)
    const html = readFileSync(assetsPath, "utf-8")
    console.log(`Loaded ${widgetName} HTML from:`, htmlFile)

    // Cache it
    if (widgetName === "bubble-wrap") {
      bubbleWrapWidgetHtml = html
    }

    return html
  } catch (error) {
    // Fallback: if assets aren't built yet, return a dev-mode HTML
    console.error(
      `${widgetName} widget assets not found, using dev mode HTML. Run 'npm run build:widgets' first.`,
      error
    )
    return `<!doctype html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
  <p>${widgetName} widget assets not found, using dev mode HTML. Run 'npm run build:widgets' first.</p>
</body>
</html>`
  }
}

export function initMcpServer(): McpServer {
  // Create a new server instance for this specific session.
  // MCP icons specification: https://modelcontextprotocol.io/specification/2025-11-25/basic/index#icons
  const server = new McpServer({
    name: "mcp-bubble-wrap",
    version: "1.0.0",
    icons: [
      {
        src: `${BASE_URL}/assets/bubble-wrap-app-icon.svg`,
        mimeType: "image/svg+xml",
        sizes: ["any"], // SVG is scalable
      },
    ],
  })

  // Step 1: Register the Apps SDK template resources
  // These templates are for ChatGPT (Apps SDK) and include the adapter

  // Bubble Wrap template
  const bubbleWrapTemplate = createUIResource({
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
      htmlString: loadWidgetHtml("bubble-wrap"),
    },

    metadata: {
      "openai/widgetDescription":
        "An interactive bubble wrap simulator where you can pop virtual bubbles for stress relief",
      "openai/widgetPrefersBorder": true,
      "openai/widgetCSP": {
        // CSP configuration per https://developers.openai.com/apps-sdk/build/mcp-server/
        // Allow audio files to be served from the MCP server
        connect_domains: [BASE_URL],
        resource_domains: [BASE_URL],
      },
      "dev/widgetHtml": bubbleWrapWidgetHtml,
    },
  })

  // Register the templates as resources
  server.registerResource(
    "bubble-wrap-template",
    BUBBLE_WRAP_TEMPLATE_URI,
    {
      title: "Bubble Wrap Template",
      description: "Template for Apps SDK",
      mimeType: "text/html",
    },
    async (uri) => ({
      contents: [bubbleWrapTemplate.resource],
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

      // Return both text content and the UI resource
      const structuredContent: BubbleWrapStructuredContent = {
        bubbleCount: validBubbleCount,
      }

      // Create MCP-UI embedded resource (without Apps SDK adapter)
      // This is for MCP-native hosts
      const uiResource = createUIResource({
        uri: `ui://widgets/bubble-wrap/${validBubbleCount}`,
        encoding: "text",
        content: {
          type: "rawHtml",
          htmlString: loadWidgetHtml("bubble-wrap"),
        },
        uiMetadata: {
          "initial-render-data": {
            firstName: "Andrew",
            lastName: "Harvard",
            structuredContent,
          },
        },
      })

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
