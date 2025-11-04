import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createUIResource } from "@mcp-ui/server";
import { z } from "zod";

// Template URI for Apps SDK
const BUBBLE_WRAP_TEMPLATE_URI = "ui://widgets/bubble-wrap";

// Function to generate the bubble wrap widget HTML
function renderBubbleWrapWidget(bubbleCount: number): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bubble Wrap</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 20px;
        }
        
        .header {
            text-align: center;
            color: white;
            margin-bottom: 30px;
        }
        
        h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        
        .stats {
            background: rgba(255, 255, 255, 0.2);
            backdrop-filter: blur(10px);
            padding: 15px 30px;
            border-radius: 20px;
            color: white;
            font-size: 1.2em;
            margin-bottom: 20px;
        }
        
        #bubble-container {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(50px, 1fr));
            gap: 10px;
            max-width: 800px;
            width: 100%;
            padding: 20px;
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        }
        
        .bubble {
            width: 50px;
            height: 50px;
            background: radial-gradient(circle at 30% 30%, #fff, #e0e0e0);
            border-radius: 50%;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 
                inset -2px -2px 4px rgba(0,0,0,0.2),
                inset 2px 2px 4px rgba(255,255,255,0.8),
                0 4px 8px rgba(0,0,0,0.2);
            position: relative;
        }
        
        .bubble:hover:not(.popped) {
            transform: scale(1.1);
        }
        
        .bubble:active:not(.popped) {
            transform: scale(0.95);
        }
        
        .bubble.popped {
            background: #333;
            box-shadow: inset 0 0 5px rgba(0,0,0,0.5);
            cursor: default;
            animation: pop 0.3s ease-out;
        }
        
        @keyframes pop {
            0% {
                transform: scale(1);
            }
            50% {
                transform: scale(1.3);
                opacity: 0.7;
            }
            100% {
                transform: scale(1);
                opacity: 1;
            }
        }
        
        .reset-btn {
            margin-top: 20px;
            padding: 12px 30px;
            font-size: 1.1em;
            background: white;
            color: #667eea;
            border: none;
            border-radius: 25px;
            cursor: pointer;
            font-weight: bold;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            transition: all 0.3s ease;
        }
        
        .reset-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(0,0,0,0.3);
        }
        
        .reset-btn:active {
            transform: translateY(0);
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🫧 Bubble Wrap Simulator 🫧</h1>
        <p>Click to pop!</p>
    </div>
    
    <div class="stats">
        Popped: <span id="popped-count">0</span> / ${bubbleCount}
    </div>
    
    <div id="bubble-container"></div>
    
    <button class="reset-btn" onclick="resetBubbles()">Reset All Bubbles</button>
    
    <script>
        const bubbleCount = ${bubbleCount};
        let poppedCount = 0;
        
        function createBubbles() {
            const container = document.getElementById("bubble-container");
            container.innerHTML = "";
            
            for (let i = 0; i < bubbleCount; i++) {
                const bubble = document.createElement("div");
                bubble.className = "bubble";
                bubble.onclick = function() {
                    if (!this.classList.contains("popped")) {
                        this.classList.add("popped");
                        poppedCount++;
                        updateCounter();
                    }
                };
                container.appendChild(bubble);
            }
        }
        
        function updateCounter() {
            document.getElementById("popped-count").textContent = poppedCount;
        }
        
        function resetBubbles() {
            poppedCount = 0;
            updateCounter();
            createBubbles();
        }
        
        // Initialize bubbles on load
        createBubbles();
    </script>
</body>
</html>`;
}

export function initMcpServer(): McpServer {
    // Create a new server instance for this specific session.
    const server = new McpServer({
        name: "mcp-bubble-wrap",
        version: "1.0.0",
    });

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
            htmlString: renderBubbleWrapWidget(100), // Default 100 bubbles for template
        },
        metadata: {
            "openai/widgetDescription":
                "An interactive bubble wrap simulator where you can pop virtual bubbles for stress relief",
            "openai/widgetPrefersBorder": true,
            "openai/widgetCSP": {
                connect_domains: [],
                resource_domains: [],
            },
        },
    });

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
    );

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
                    .optional()
                    .default(100)
                    .describe(
                        "Number of bubbles to create (default: 100, max: 500)"
                    )
                    .refine((val) => val >= 1 && val <= 500, {
                        message: "Bubble count must be between 1 and 500",
                    }),
            },
            // Apps SDK metadata
            _meta: {
                "openai/outputTemplate": BUBBLE_WRAP_TEMPLATE_URI,
                "openai/toolInvocation/invoking": "Creating bubble wrap...",
                "openai/toolInvocation/invoked": "Bubble wrap ready to pop!",
                "openai/widgetAccessible": true,
            },
        },
        async ({ bubbleCount = 100 }: { bubbleCount?: number }) => {
            // Validate and clamp bubble count
            const validBubbleCount = Math.min(
                Math.max(Math.floor(bubbleCount), 1),
                500
            );

            // Create MCP-UI embedded resource (without Apps SDK adapter)
            // This is for MCP-native hosts
            const uiResource = createUIResource({
                uri: `ui://widgets/bubble-wrap/${validBubbleCount}`,
                encoding: "text",
                content: {
                    type: "rawHtml",
                    htmlString: renderBubbleWrapWidget(validBubbleCount),
                },
            });

            // Return both text content and the UI resource
            return {
                content: [
                    {
                        type: "text",
                        text: `Created a bubble wrap simulator with ${validBubbleCount} bubbles. Click to pop them all!`,
                    },
                    uiResource,
                ],
                // Structured content for Apps SDK
                structuredContent: {
                    bubbleCount: validBubbleCount,
                },
            };
        }
    );

    return server;
}
