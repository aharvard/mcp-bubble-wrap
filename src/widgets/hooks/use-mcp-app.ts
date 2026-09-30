/**
 * MCP Apps host integration for widgets.
 *
 * Wraps the official `@modelcontextprotocol/ext-apps` `App` class and exposes
 * its state to React. The connection is established once at the widget root
 * via `McpAppProvider`; components read it with `useMcpApp()`.
 *
 * When the widget is running inside ChatGPT (`window.openai` is present) the
 * MCP Apps handshake is skipped entirely: that host speaks the OpenAI Apps SDK
 * instead, which is handled by `use-openai-global.ts`.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import {
  App,
  PostMessageTransport,
  type McpUiHostContext,
  type McpUiToolResultNotification,
} from "@modelcontextprotocol/ext-apps"
import { DECLARED_DISPLAY_MODES } from "../../shared/display-modes"
import {
  DisplayModeCompatTransport,
  type HostDisplayModes,
} from "../lib/display-mode-compat-transport"

export type McpToolResult = McpUiToolResultNotification["params"]

export interface McpAppState {
  /** Connected `App` instance, or null until the handshake completes. */
  app: App | null
  /** True once `ui/initialize` has completed. */
  isConnected: boolean
  /** Connection error, if the handshake failed. */
  error: Error | null
  /** Latest host context (theme, display mode, viewport, ...). */
  hostContext: McpUiHostContext | null
  /**
   * Display mode values as the host really sent them, including non-spec
   * modes (Goose's split-right / split-bottom / standalone) that the SDK's
   * own `hostContext` cannot represent. See `DisplayModeCompatTransport`.
   */
  hostDisplayModes: HostDisplayModes
  /** Arguments of the tool call that rendered this app. */
  toolInput: Record<string, unknown> | null
  /** Result of the tool call that rendered this app. */
  toolResult: McpToolResult | null
  /** Replace the tool result (e.g. after the app calls a server tool itself). */
  setToolResult: (result: McpToolResult | null) => void
}

const APP_INFO = { name: "Bubble Wrap", version: "1.0.0" }

/** True when running inside ChatGPT (OpenAI Apps SDK host). */
export function isOpenAiHost(): boolean {
  return typeof window !== "undefined" && typeof window.openai !== "undefined"
}

const noopState: McpAppState = {
  app: null,
  isConnected: false,
  error: null,
  hostContext: null,
  hostDisplayModes: {},
  toolInput: null,
  toolResult: null,
  setToolResult: () => {},
}

const McpAppContext = createContext<McpAppState>(noopState)

/**
 * Connects to the MCP Apps host (unless running in ChatGPT) and tracks the
 * resulting state. Only call this once per widget; prefer `McpAppProvider`.
 */
export function useMcpAppConnection(): McpAppState {
  const [app, setApp] = useState<App | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [hostContext, setHostContext] = useState<McpUiHostContext | null>(null)
  const [hostDisplayModes, setHostDisplayModes] = useState<HostDisplayModes>({})
  const [toolInput, setToolInput] = useState<Record<string, unknown> | null>(
    null
  )
  const [toolResult, setToolResult] = useState<McpToolResult | null>(null)

  useEffect(() => {
    if (isOpenAiHost()) {
      console.log(
        "[useMcpApp] window.openai detected, skipping MCP Apps handshake"
      )
      return
    }

    let active = true

    const instance = new App(
      APP_INFO,
      {
        // Declare every display mode this app can render in. Goose (and any
        // other host that understands them) will offer the non-spec modes;
        // hosts that don't will simply never grant them.
        availableDisplayModes: DECLARED_DISPLAY_MODES,
      },
      { autoResize: true }
    )

    // Handlers must be registered before connect() so no notification is missed.
    instance.ontoolinput = (params) => {
      console.log("[useMcpApp] tool input:", params)
      setToolInput(params.arguments ?? null)
    }
    instance.ontoolinputpartial = (params) => {
      setToolInput((current) => ({ ...current, ...params.arguments }))
    }
    instance.ontoolresult = (params) => {
      console.log("[useMcpApp] tool result:", params)
      setToolResult(params)
    }
    instance.onhostcontextchanged = (params) => {
      console.log("[useMcpApp] host context changed:", params)
      setHostContext((current) => ({ ...current, ...params }))
    }

    // Wrap the transport so hosts offering non-spec display modes (Goose)
    // don't fail the SDK's schema validation; the real values are exposed via
    // `hostDisplayModes`.
    const transport = new DisplayModeCompatTransport(
      new PostMessageTransport(window.parent, window.parent)
    )
    transport.onhostmodeschanged = (modes) => {
      if (!active) return
      console.log("[useMcpApp] host display modes:", modes)
      setHostDisplayModes(modes)
    }

    instance
      .connect(transport)
      .then(() => {
        if (!active) {
          void instance.close()
          return
        }
        console.log("[useMcpApp] connected", {
          host: instance.getHostVersion(),
          hostCapabilities: instance.getHostCapabilities(),
          hostContext: instance.getHostContext(),
        })
        setApp(instance)
        setHostContext(instance.getHostContext() ?? null)
        setIsConnected(true)
        setError(null)
      })
      .catch((err: unknown) => {
        if (!active) return
        console.error("[useMcpApp] failed to connect to host:", err)
        setError(err instanceof Error ? err : new Error(String(err)))
      })

    return () => {
      active = false
      void instance.close()
    }
  }, [])

  const setToolResultStable = useCallback((result: McpToolResult | null) => {
    setToolResult(result)
  }, [])

  return useMemo(
    () => ({
      app,
      isConnected,
      error,
      hostContext,
      hostDisplayModes,
      toolInput,
      toolResult,
      setToolResult: setToolResultStable,
    }),
    [
      app,
      isConnected,
      error,
      hostContext,
      hostDisplayModes,
      toolInput,
      toolResult,
      setToolResultStable,
    ]
  )
}

/** Provides the MCP Apps connection to the widget tree. */
export function McpAppProvider({ children }: { children: React.ReactNode }) {
  const state = useMcpAppConnection()
  return React.createElement(McpAppContext.Provider, { value: state }, children)
}

/** Read the MCP Apps connection state provided by `McpAppProvider`. */
export function useMcpApp(): McpAppState {
  return useContext(McpAppContext)
}
