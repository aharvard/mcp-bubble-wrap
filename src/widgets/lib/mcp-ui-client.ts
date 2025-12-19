/**
 * MCP Apps UI Client SDK
 *
 * Implements SEP-1865 JSON-RPC 2.0 over postMessage for iframe-host communication.
 * This is the client-side (Guest UI) implementation.
 *
 * @see https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/draft/apps.mdx
 */

// =============================================================================
// JSON-RPC 2.0 Types
// =============================================================================

interface JsonRpcRequest<TParams = unknown> {
  jsonrpc: "2.0"
  id: string | number
  method: string
  params?: TParams
}

interface JsonRpcResponse<TResult = unknown> {
  jsonrpc: "2.0"
  id: string | number
  result?: TResult
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

interface JsonRpcNotification<TParams = unknown> {
  jsonrpc: "2.0"
  method: string
  params?: TParams
}

// =============================================================================
// MCP Apps Protocol Types (SEP-1865)
// =============================================================================

/** Display mode for the UI */
export type DisplayMode = "inline" | "fullscreen" | "pip"

/** Color theme preference */
export type Theme = "light" | "dark"

/** Platform type */
export type Platform = "web" | "desktop" | "mobile"

/** Viewport dimensions */
export interface Viewport {
  width: number
  height: number
  maxWidth?: number
  maxHeight?: number
}

/** Safe area insets */
export interface SafeAreaInsets {
  top: number
  right: number
  bottom: number
  left: number
}

/** Device capabilities */
export interface DeviceCapabilities {
  touch?: boolean
  hover?: boolean
}

/** Tool information */
export interface ToolInfo {
  id?: string | number
  tool: {
    name: string
    description?: string
    inputSchema?: object
  }
}

/** Host context provided during initialization */
export interface HostContext {
  toolInfo?: ToolInfo
  theme?: Theme
  displayMode?: DisplayMode
  availableDisplayModes?: DisplayMode[]
  viewport?: Viewport
  locale?: string
  timeZone?: string
  userAgent?: string
  platform?: Platform
  deviceCapabilities?: DeviceCapabilities
  safeAreaInsets?: SafeAreaInsets
}

/** Parameters for ui/initialize request */
export interface UiInitializeParams {
  protocolVersion?: string
  capabilities?: Record<string, unknown>
  clientInfo?: {
    name: string
    version: string
  }
}

/** Result of ui/initialize request */
export interface UiInitializeResult {
  protocolVersion: string
  hostCapabilities?: Record<string, unknown>
  hostInfo?: {
    name: string
    version: string
  }
  hostContext?: HostContext
}

/** Parameters for ui/notifications/tool-input notification */
export interface ToolInputParams {
  arguments: Record<string, unknown>
}

/** Parameters for ui/notifications/tool-result notification */
export interface ToolResultParams {
  content?: Array<{
    type: string
    text?: string
    [key: string]: unknown
  }>
  structuredContent?: Record<string, unknown>
  isError?: boolean
}

/** Parameters for ui/notifications/host-context-changed notification */
export type HostContextChangedParams = Partial<HostContext>

// =============================================================================
// MCP UI Client
// =============================================================================

type NotificationHandler<T = unknown> = (params: T) => void

interface PendingRequest {
  resolve: (result: unknown) => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout>
}

export interface McpUiClientOptions {
  /** Client name for initialization */
  clientName?: string
  /** Client version for initialization */
  clientVersion?: string
  /** Request timeout in milliseconds */
  timeout?: number
  /** Enable debug logging */
  debug?: boolean
}

export class McpUiClient {
  private requestId = 0
  private pendingRequests = new Map<string | number, PendingRequest>()
  private notificationHandlers = new Map<string, Set<NotificationHandler>>()
  private initialized = false
  private hostContext: HostContext | null = null
  private toolArguments: Record<string, unknown> | null = null
  private toolResult: ToolResultParams | null = null

  private readonly options: Required<McpUiClientOptions>

  constructor(options: McpUiClientOptions = {}) {
    this.options = {
      clientName: options.clientName ?? "mcp-ui-client",
      clientVersion: options.clientVersion ?? "1.0.0",
      timeout: options.timeout ?? 30000,
      debug: options.debug ?? false,
    }

    // Set up message listener
    window.addEventListener("message", this.handleMessage)

    this.log("MCP UI Client created")
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  /**
   * Initialize the connection with the host.
   * This should be called once when the UI loads.
   *
   * Flow per SEP-1865:
   * 1. UI sends `ui/initialize` request
   * 2. Host responds with `McpUiInitializeResult`
   * 3. UI sends `ui/notifications/initialized` notification
   * 4. Host sends `ui/notifications/tool-input` and `ui/notifications/tool-result`
   */
  async initialize(): Promise<UiInitializeResult> {
    this.log("Initializing connection with host...")

    const result = await this.sendRequest<UiInitializeResult>("ui/initialize", {
      protocolVersion: "2025-01-01",
      clientInfo: {
        name: this.options.clientName,
        version: this.options.clientVersion,
      },
      capabilities: {},
    } satisfies UiInitializeParams)

    this.initialized = true
    this.hostContext = result.hostContext ?? null

    this.log("Initialized successfully:", result)

    // Send ui/notifications/initialized to tell host we're ready for tool data
    this.sendNotification("ui/notifications/initialized", {})
    this.log("Sent ui/notifications/initialized notification")

    return result
  }

  /**
   * Check if the client has been initialized.
   */
  isInitialized(): boolean {
    return this.initialized
  }

  /**
   * Get the host context from initialization.
   */
  getHostContext(): HostContext | null {
    return this.hostContext
  }

  /**
   * Get the tool arguments received from the host.
   */
  getToolArguments(): Record<string, unknown> | null {
    return this.toolArguments
  }

  /**
   * Get the tool result received from the host.
   */
  getToolResult(): ToolResultParams | null {
    return this.toolResult
  }

  /**
   * Subscribe to a notification from the host.
   */
  onNotification<T = unknown>(
    method: string,
    handler: NotificationHandler<T>
  ): () => void {
    if (!this.notificationHandlers.has(method)) {
      this.notificationHandlers.set(method, new Set())
    }
    this.notificationHandlers.get(method)!.add(handler as NotificationHandler)

    // Return unsubscribe function
    return () => {
      this.notificationHandlers
        .get(method)
        ?.delete(handler as NotificationHandler)
    }
  }

  /**
   * Subscribe to tool input notifications.
   */
  onToolInput(handler: NotificationHandler<ToolInputParams>): () => void {
    return this.onNotification("ui/notifications/tool-input", handler)
  }

  /**
   * Subscribe to partial tool input notifications (streaming).
   */
  onToolInputPartial(
    handler: NotificationHandler<ToolInputParams>
  ): () => void {
    return this.onNotification("ui/notifications/tool-input-partial", handler)
  }

  /**
   * Subscribe to tool result notifications.
   */
  onToolResult(handler: NotificationHandler<ToolResultParams>): () => void {
    return this.onNotification("ui/notifications/tool-result", handler)
  }

  /**
   * Subscribe to host context change notifications.
   */
  onHostContextChanged(
    handler: NotificationHandler<HostContextChangedParams>
  ): () => void {
    return this.onNotification("ui/notifications/host-context-changed", handler)
  }

  /**
   * Send a size change notification to the host.
   */
  notifySizeChanged(width: number, height: number): void {
    this.sendNotification("ui/notifications/size-changed", { width, height })
  }

  /**
   * Request the host to open an external URL.
   * The host will typically open this in the user's default browser.
   *
   * @param url - The URL to open
   * @returns Promise that resolves when the host acknowledges the request
   * @throws Error if the host denies the request or the URL is invalid
   */
  async openLink(url: string): Promise<void> {
    this.log("Opening link:", url)
    await this.sendRequest<Record<string, never>>("ui/open-link", { url })
  }

  /**
   * Call a tool through the host.
   * The host will execute the tool and send the result via notifications.
   *
   * @param name - The name of the tool to call
   * @param args - The arguments to pass to the tool
   * @returns Promise that resolves with the tool call result
   */
  async callTool(
    name: string,
    args: Record<string, unknown> = {}
  ): Promise<{
    content?: Array<{ type: string; text?: string; [key: string]: unknown }>
    structuredContent?: Record<string, unknown>
    isError?: boolean
  }> {
    this.log("Calling tool:", name, args)
    const result = await this.sendRequest<{
      content?: Array<{ type: string; text?: string; [key: string]: unknown }>
      structuredContent?: Record<string, unknown>
      isError?: boolean
    }>("tools/call", { name, arguments: args })
    return result
  }

  /**
   * Clean up resources.
   */
  destroy(): void {
    window.removeEventListener("message", this.handleMessage)
    this.pendingRequests.forEach((pending) => {
      clearTimeout(pending.timeout)
      pending.reject(new Error("Client destroyed"))
    })
    this.pendingRequests.clear()
    this.notificationHandlers.clear()
    this.log("Client destroyed")
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private handleMessage = (event: MessageEvent): void => {
    const data = event.data

    // Ignore non-JSON-RPC messages
    if (!data || data.jsonrpc !== "2.0") {
      return
    }

    this.log("Received message:", data)

    // Handle response to a request
    if ("id" in data && data.id !== null) {
      this.handleResponse(data as JsonRpcResponse)
      return
    }

    // Handle notification
    if ("method" in data && !("id" in data)) {
      this.handleNotification(data as JsonRpcNotification)
      return
    }
  }

  private handleResponse(response: JsonRpcResponse): void {
    const pending = this.pendingRequests.get(response.id)
    if (!pending) {
      this.log("Received response for unknown request:", response.id)
      return
    }

    this.pendingRequests.delete(response.id)
    clearTimeout(pending.timeout)

    if (response.error) {
      pending.reject(
        new Error(`${response.error.message} (code: ${response.error.code})`)
      )
    } else {
      pending.resolve(response.result)
    }
  }

  private handleNotification(notification: JsonRpcNotification): void {
    this.log("Handling notification:", notification.method)

    // Store tool arguments and results internally
    if (notification.method === "ui/notifications/tool-input") {
      this.toolArguments =
        (notification.params as ToolInputParams)?.arguments ?? null
    } else if (notification.method === "ui/notifications/tool-result") {
      this.toolResult = (notification.params as ToolResultParams) ?? null
    } else if (
      notification.method === "ui/notifications/host-context-changed"
    ) {
      // Merge host context changes
      if (this.hostContext && notification.params) {
        this.hostContext = {
          ...this.hostContext,
          ...(notification.params as HostContextChangedParams),
        }
      }
    }

    // Call registered handlers
    const handlers = this.notificationHandlers.get(notification.method)
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(notification.params)
        } catch (error) {
          console.error(
            `[McpUiClient] Error in notification handler for ${notification.method}:`,
            error
          )
        }
      })
    }
  }

  private sendRequest<TResult>(
    method: string,
    params?: unknown
  ): Promise<TResult> {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId

      const request: JsonRpcRequest = {
        jsonrpc: "2.0",
        id,
        method,
        params,
      }

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id)
        reject(
          new Error(
            `Request ${method} timed out after ${this.options.timeout}ms`
          )
        )
      }, this.options.timeout)

      this.pendingRequests.set(id, {
        resolve: resolve as (result: unknown) => void,
        reject,
        timeout,
      })

      this.log("Sending request:", request)
      window.parent.postMessage(request, "*")
    })
  }

  private sendNotification(method: string, params?: unknown): void {
    const notification: JsonRpcNotification = {
      jsonrpc: "2.0",
      method,
      params,
    }

    this.log("Sending notification:", notification)
    window.parent.postMessage(notification, "*")
  }

  private log(...args: unknown[]): void {
    if (this.options.debug) {
      console.log("[McpUiClient]", ...args)
    }
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let clientInstance: McpUiClient | null = null

/**
 * Get or create the singleton MCP UI client instance.
 */
export function getMcpUiClient(options?: McpUiClientOptions): McpUiClient {
  if (!clientInstance) {
    clientInstance = new McpUiClient(options)
  }
  return clientInstance
}

/**
 * Reset the singleton instance (useful for testing).
 */
export function resetMcpUiClient(): void {
  if (clientInstance) {
    clientInstance.destroy()
    clientInstance = null
  }
}
