/**
 * MCP Apps UI Client Library
 *
 * Exports for building MCP Apps widgets with the SEP-1865 protocol.
 */

// Core client
export {
  McpUiClient,
  getMcpUiClient,
  resetMcpUiClient,
  type McpUiClientOptions,
  type HostContext,
  type ToolInfo,
  type ToolInputParams,
  type ToolResultParams,
  type HostContextChangedParams,
  type UiInitializeParams,
  type UiInitializeResult,
  type DisplayMode,
  type Theme,
  type Platform,
  type Viewport,
  type SafeAreaInsets,
  type DeviceCapabilities,
} from "./mcp-ui-client.js"

// React hooks
export {
  useMcpUi,
  useToolArguments,
  useToolResult,
  useHostContext,
  useHostContextValue,
  useTheme,
  useDisplayMode,
  useAvailableDisplayModes,
  useViewport,
  useSafeAreaInsets,
  useSizeNotifier,
  useOpenLink,
  useCallTool,
  type ToolCallResult,
} from "./use-mcp-ui.js"
