import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createUIResource } from "@mcp-ui/server";

export function initMcpServer(): McpServer {
    // Create a new server instance for this specific session.
    const server = new McpServer({
        name: "typescript-server-demo",
        version: "1.0.0",
    });

    server.registerTool(
        "greet",
        {
            title: "Greet",
            description:
                "Creates a UI resource displaying an external URL (example.com).",
            inputSchema: {},
        },
        async () => {
            const uiResource = createUIResource({
                uri: "ui://greeting",
                content: {
                    type: "externalUrl",
                    iframeUrl: "https://example.com",
                },
                encoding: "text",
            });

            return {
                content: [uiResource],
            };
        }
    );

    return server;
}
