import express from "express"
import cors from "cors"
import chalk from "chalk"
import path from "path"
import { fileURLToPath } from "url"
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js"
import { randomUUID } from "crypto"
import {
  logClientMessage,
  logServerMessage,
  logSessionInitialized,
  logSessionClosed,
  logSessionRequestFailed,
  logServerStarted,
  logStaticAssets,
} from "./utils/logger.js"
import { initMcpServer } from "./mcp-server.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const port = process.env.PORT || 5678

app.use(
  cors({
    origin: "*",
    exposedHeaders: ["Mcp-Session-Id"],
    allowedHeaders: ["Content-Type", "mcp-session-id"],
  })
)
app.use(express.json())

// Map to store transports by session ID, as shown in the documentation.
const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {}

// Handle POST requests for client-to-server communication.
app.post("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined
  let transport: StreamableHTTPServerTransport

  if (sessionId && transports[sessionId]) {
    // A session already exists; reuse the existing transport.
    console.log(chalk.gray(`♻️  Reusing transport for session: ${sessionId}`))
    transport = transports[sessionId]
  } else if (!sessionId && isInitializeRequest(req.body)) {
    // This is a new initialization request. Create a new transport.
    console.log(chalk.yellow("🔄 Creating new MCP session..."))
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sid) => {
        transports[sid] = transport
        logSessionInitialized(sid, Object.keys(transports).length)
      },
    })

    // Log incoming messages from the client
    transport.onmessage = (message) => {
      logClientMessage(transport.sessionId, message)
    }

    // Wrap the transport's send method to log outgoing messages
    const originalSend = transport.send.bind(transport)
    transport.send = async (message, options) => {
      logServerMessage(transport.sessionId, message)
      return originalSend(message, options)
    }

    // Clean up the transport from our map when the session closes.
    transport.onclose = () => {
      if (transport.sessionId) {
        logSessionClosed(
          transport.sessionId,
          Object.keys(transports).length - 1
        )
        delete transports[transport.sessionId]
      }
    }

    // Create and configure the MCP server for this session
    const server = initMcpServer()

    // Connect the server instance to the transport for this session.
    await server.connect(transport)
  } else {
    return res.status(400).json({
      error: { message: "Bad Request: No valid session ID provided" },
    })
  }

  // Handle the client's request using the session's transport.
  await transport.handleRequest(req, res, req.body)
})

// A separate, reusable handler for GET and DELETE requests.
const handleSessionRequest = async (
  req: express.Request,
  res: express.Response
) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined
  const methodIcon = req.method === "GET" ? "📥" : "🗑️"
  const methodColor = req.method === "GET" ? chalk.cyan : chalk.red

  if (!sessionId || !transports[sessionId]) {
    logSessionRequestFailed(
      req.method,
      sessionId,
      Object.keys(transports).length
    )
    return res.status(404).send("Session not found")
  }

  console.log(
    methodColor(`${methodIcon} ${req.method} request for session: ${sessionId}`)
  )

  const transport = transports[sessionId]
  await transport.handleRequest(req, res)
}

// GET handles the long-lived stream for server-to-client messages.
app.get("/mcp", handleSessionRequest)

// DELETE handles explicit session termination from the client.
app.delete("/mcp", handleSessionRequest)

app.listen(port, () => {
  logServerStarted(port)
})
