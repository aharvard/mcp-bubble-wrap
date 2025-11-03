import express from "express";
import cors from "cors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { createUIResource } from "@mcp-ui/server";
import { randomUUID } from "crypto";

const app = express();
const port = process.env.PORT || 5678;

app.use(
    cors({
        origin: "*",
        exposedHeaders: ["Mcp-Session-Id"],
        allowedHeaders: ["Content-Type", "mcp-session-id"],
    })
);
app.use(express.json());

// Map to store transports by session ID, as shown in the documentation.
const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

// Handle POST requests for client-to-server communication.
app.post("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    // Log incoming client message
    console.log("=== MCP Client Message ===");
    console.log("Session ID:", sessionId || "(new session)");
    console.log("Message type:", req.body.method || req.body.jsonrpc);
    console.log("Full message:", JSON.stringify(req.body, null, 2));
    console.log("========================");

    if (sessionId && transports[sessionId]) {
        // A session already exists; reuse the existing transport.
        console.log(`Reusing existing transport for session: ${sessionId}`);
        transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
        // This is a new initialization request. Create a new transport.
        console.log("Creating new MCP session (initialize request)");
        transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (sid) => {
                transports[sid] = transport;
                console.log(`✓ MCP Session initialized: ${sid}`);
            },
        });

        // Clean up the transport from our map when the session closes.
        transport.onclose = () => {
            if (transport.sessionId) {
                console.log(`✗ MCP Session closed: ${transport.sessionId}`);
                delete transports[transport.sessionId];
            }
        };

        // Create a new server instance for this specific session.
        const server = new McpServer({
            name: "typescript-server-demo",
            version: "1.0.0",
        });

        // Register our tool on the new server instance.
        server.registerTool(
            "greet",
            {
                title: "Greet",
                description:
                    "Creates a UI resource displaying an external URL (example.com).",
                inputSchema: {},
            },
            async () => {
                // Create the UI resource to be returned to the client
                // This is the only MCP-UI specific code in this example
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

        // Connect the server instance to the transport for this session.
        await server.connect(transport);
    } else {
        return res.status(400).json({
            error: { message: "Bad Request: No valid session ID provided" },
        });
    }

    // Handle the client's request using the session's transport.
    await transport.handleRequest(req, res, req.body);
});

// A separate, reusable handler for GET and DELETE requests.
const handleSessionRequest = async (
    req: express.Request,
    res: express.Response
) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    console.log(`=== MCP ${req.method} Request ===`);
    console.log("Session ID:", sessionId || "(missing)");

    if (!sessionId || !transports[sessionId]) {
        console.log("❌ Session not found");
        console.log("========================");
        return res.status(404).send("Session not found");
    }

    console.log(`✓ Handling ${req.method} request for session: ${sessionId}`);
    console.log("========================");

    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
};

// GET handles the long-lived stream for server-to-client messages.
app.get("/mcp", handleSessionRequest);

// DELETE handles explicit session termination from the client.
app.delete("/mcp", handleSessionRequest);

app.listen(port, () => {
    console.log(`TypeScript MCP server listening at http://localhost:${port}`);
});
