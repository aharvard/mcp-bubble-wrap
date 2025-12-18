/**
 * React hooks for MCP Apps UI Client
 *
 * Provides easy-to-use React hooks for the MCP Apps JSON-RPC protocol.
 */

import { useEffect, useCallback, useSyncExternalStore, useRef } from "react"
import {
  getMcpUiClient,
  type McpUiClient,
  type HostContext,
  type ToolInputParams,
  type ToolResultParams,
  type McpUiClientOptions,
} from "./mcp-ui-client.js"

// =============================================================================
// Store for reactive state
// =============================================================================

interface McpUiState {
  initialized: boolean
  hostContext: HostContext | null
  toolArguments: Record<string, unknown> | null
  toolResult: ToolResultParams | null
  error: Error | null
}

type StateListener = () => void

class McpUiStore {
  private state: McpUiState = {
    initialized: false,
    hostContext: null,
    toolArguments: null,
    toolResult: null,
    error: null,
  }

  private listeners = new Set<StateListener>()
  private client: McpUiClient | null = null
  private initPromise: Promise<void> | null = null

  getState(): McpUiState {
    return this.state
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener())
  }

  private setState(partial: Partial<McpUiState>): void {
    this.state = { ...this.state, ...partial }
    this.notify()
  }

  async initialize(options?: McpUiClientOptions): Promise<void> {
    // Return existing promise if already initializing
    if (this.initPromise) {
      return this.initPromise
    }

    // Already initialized
    if (this.state.initialized) {
      return
    }

    this.initPromise = this.doInitialize(options)
    return this.initPromise
  }

  private async doInitialize(options?: McpUiClientOptions): Promise<void> {
    try {
      this.client = getMcpUiClient({
        debug: true,
        ...options,
      })

      // Set up notification handlers
      this.client.onToolInput((params: ToolInputParams) => {
        console.log("[McpUiStore] Received tool input:", params)
        this.setState({ toolArguments: params.arguments })
      })

      this.client.onToolInputPartial((params: ToolInputParams) => {
        console.log("[McpUiStore] Received partial tool input:", params)
        // For partial updates, merge with existing arguments
        this.setState({
          toolArguments: {
            ...this.state.toolArguments,
            ...params.arguments,
          },
        })
      })

      this.client.onToolResult((params: ToolResultParams) => {
        console.log("[McpUiStore] Received tool result:", params)
        this.setState({ toolResult: params })
      })

      this.client.onHostContextChanged((params) => {
        console.log("[McpUiStore] Host context changed:", params)
        this.setState({
          hostContext: {
            ...this.state.hostContext,
            ...params,
          },
        })
      })

      // Initialize the connection
      const result = await this.client.initialize()

      this.setState({
        initialized: true,
        hostContext: result.hostContext ?? null,
        error: null,
      })

      console.log("[McpUiStore] Initialized successfully:", result)
    } catch (error) {
      console.error("[McpUiStore] Initialization failed:", error)
      this.setState({
        error: error instanceof Error ? error : new Error(String(error)),
      })
      throw error
    }
  }

  getClient(): McpUiClient | null {
    return this.client
  }
}

// Singleton store instance
const store = new McpUiStore()

// =============================================================================
// React Hooks
// =============================================================================

/**
 * Hook to initialize and access the MCP UI client.
 *
 * This hook should be called once at the top level of your widget.
 * It handles initialization and provides reactive access to the client state.
 */
export function useMcpUi(options?: McpUiClientOptions): {
  initialized: boolean
  hostContext: HostContext | null
  toolArguments: Record<string, unknown> | null
  toolResult: ToolResultParams | null
  error: Error | null
  client: McpUiClient | null
} {
  // Use useSyncExternalStore for reactive updates
  const state = useSyncExternalStore(
    store.subscribe.bind(store),
    store.getState.bind(store),
    store.getState.bind(store)
  )

  // Initialize on mount
  useEffect(() => {
    store.initialize(options).catch((error) => {
      console.error("[useMcpUi] Initialization error:", error)
    })
  }, []) // Only run once on mount

  return {
    ...state,
    client: store.getClient(),
  }
}

/**
 * Hook to get the current tool arguments.
 */
export function useToolArguments<T = Record<string, unknown>>(): T | null {
  const state = useSyncExternalStore(
    store.subscribe.bind(store),
    () => store.getState().toolArguments as T | null,
    () => store.getState().toolArguments as T | null
  )
  return state
}

/**
 * Hook to get the current tool result.
 */
export function useToolResult(): ToolResultParams | null {
  return useSyncExternalStore(
    store.subscribe.bind(store),
    () => store.getState().toolResult,
    () => store.getState().toolResult
  )
}

/**
 * Hook to get the current host context.
 */
export function useHostContext(): HostContext | null {
  return useSyncExternalStore(
    store.subscribe.bind(store),
    () => store.getState().hostContext,
    () => store.getState().hostContext
  )
}

/**
 * Hook to get a specific value from the host context.
 */
export function useHostContextValue<K extends keyof HostContext>(
  key: K
): HostContext[K] | null {
  return useSyncExternalStore(
    store.subscribe.bind(store),
    () => store.getState().hostContext?.[key] ?? null,
    () => store.getState().hostContext?.[key] ?? null
  )
}

/**
 * Hook to get the current theme from host context.
 */
export function useTheme(): "light" | "dark" {
  const theme = useHostContextValue("theme")
  return theme ?? "light"
}

/**
 * Hook to get the current display mode from host context.
 */
export function useDisplayMode(): "inline" | "fullscreen" | "pip" {
  const displayMode = useHostContextValue("displayMode")
  return displayMode ?? "inline"
}

/**
 * Hook to get available display modes from host context.
 */
export function useAvailableDisplayModes(): Array<
  "inline" | "fullscreen" | "pip"
> {
  const availableModes = useHostContextValue("availableDisplayModes")
  return (
    (availableModes as Array<"inline" | "fullscreen" | "pip">) ?? ["inline"]
  )
}

/**
 * Hook to get viewport information from host context.
 */
export function useViewport(): {
  width: number
  height: number
  maxWidth?: number
  maxHeight?: number
} | null {
  return useHostContextValue("viewport")
}

/**
 * Hook to get safe area insets from host context.
 */
export function useSafeAreaInsets(): {
  top: number
  right: number
  bottom: number
  left: number
} | null {
  return useHostContextValue("safeAreaInsets")
}

/**
 * Hook to notify the host of size changes.
 * Returns a debounced callback that can be used to report size changes.
 *
 * @param debounceMs - Debounce delay in milliseconds (default: 100)
 */
export function useSizeNotifier(
  debounceMs: number = 100
): (width: number, height: number) => void {
  const client = store.getClient()
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSizeRef = useRef<{ width: number; height: number } | null>(null)

  return useCallback(
    (width: number, height: number) => {
      // Skip if size hasn't changed
      if (
        lastSizeRef.current &&
        lastSizeRef.current.width === width &&
        lastSizeRef.current.height === height
      ) {
        return
      }

      // Clear any pending timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      // Debounce the notification
      timeoutRef.current = setTimeout(() => {
        lastSizeRef.current = { width, height }
        client?.notifySizeChanged(width, height)
      }, debounceMs)
    },
    [client, debounceMs]
  )
}

/**
 * Hook to open external links through the host.
 * Returns a function that requests the host to open a URL.
 */
export function useOpenLink(): (url: string) => Promise<void> {
  const client = store.getClient()

  return useCallback(
    async (url: string) => {
      if (!client) {
        throw new Error("MCP UI client not initialized")
      }
      await client.openLink(url)
    },
    [client]
  )
}

/**
 * Result of a tool call.
 */
export interface ToolCallResult {
  content?: Array<{ type: string; text?: string; [key: string]: unknown }>
  structuredContent?: Record<string, unknown>
  isError?: boolean
}

/**
 * Hook to call tools through the host.
 * Returns a function that calls a tool and returns the result.
 */
export function useCallTool(): (
  name: string,
  args?: Record<string, unknown>
) => Promise<ToolCallResult> {
  const client = store.getClient()

  return useCallback(
    async (name: string, args: Record<string, unknown> = {}) => {
      if (!client) {
        throw new Error("MCP UI client not initialized")
      }
      return await client.callTool(name, args)
    },
    [client]
  )
}
