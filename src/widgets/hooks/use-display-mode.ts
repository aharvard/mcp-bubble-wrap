/**
 * Host-agnostic display mode state and controls.
 *
 * - ChatGPT (OpenAI Apps SDK): `window.openai.displayMode` / `requestDisplayMode`
 *   with the three spec modes.
 * - MCP Apps hosts (Goose, etc.): the display mode values the host actually
 *   sent, captured by `DisplayModeCompatTransport` because the ext-apps SDK's
 *   own `hostContext` is validated against the spec enum and cannot carry
 *   Goose's split-right, split-bottom and standalone modes. Falls back to
 *   `hostContext` for spec-only hosts.
 */

import { useCallback, useMemo } from "react"
import type { McpUiDisplayMode } from "@modelcontextprotocol/ext-apps"
import {
  SPEC_DISPLAY_MODES,
  isDisplayMode,
  type DisplayMode,
} from "../../shared/display-modes"
import { useOpenAiGlobal } from "./use-openai-global"
import { isOpenAiHost, useMcpApp } from "./use-mcp-app"

export interface DisplayModeState {
  /** Mode the host is currently rendering the app in. */
  displayMode: DisplayMode
  /** Modes the host has offered (already intersected with what we declared). */
  availableDisplayModes: DisplayMode[]
  /** Ask the host to switch modes. Resolves to the mode actually granted. */
  requestDisplayMode: (mode: DisplayMode) => Promise<DisplayMode>
}

export function useDisplayMode(): DisplayModeState {
  const openAiDisplayMode = useOpenAiGlobal("displayMode")
  const { app, hostContext, hostDisplayModes } = useMcpApp()

  const hostMode = hostDisplayModes.displayMode ?? hostContext?.displayMode
  const hostAvailable =
    hostDisplayModes.availableDisplayModes ?? hostContext?.availableDisplayModes

  const displayMode: DisplayMode = useMemo(() => {
    const candidate = isOpenAiHost() ? openAiDisplayMode : hostMode
    return isDisplayMode(candidate) ? candidate : "inline"
  }, [openAiDisplayMode, hostMode])

  const availableDisplayModes: DisplayMode[] = useMemo(() => {
    if (isOpenAiHost()) return [...SPEC_DISPLAY_MODES]
    return (hostAvailable ?? []).filter(isDisplayMode)
  }, [hostAvailable])

  const requestDisplayMode = useCallback(
    async (mode: DisplayMode): Promise<DisplayMode> => {
      if (isOpenAiHost()) {
        if (!isSpecMode(mode)) {
          throw new Error(`ChatGPT does not support display mode "${mode}"`)
        }
        const result = await window.openai.requestDisplayMode({ mode })
        return result.mode
      }
      if (!app) {
        throw new Error("MCP Apps host not connected")
      }
      // The SDK types the request as the spec enum; Goose accepts its own
      // extra modes on the same request. A granted non-spec mode is rewritten
      // to a spec value before the SDK sees it (see DisplayModeCompatTransport),
      // so read the real answer from the transport's side channel.
      const result = await app.requestDisplayMode({
        mode: mode as McpUiDisplayMode,
      })
      const granted = hostDisplayModes.lastGrantedMode ?? result.mode
      return isDisplayMode(granted) ? granted : displayMode
    },
    [app, displayMode, hostDisplayModes.lastGrantedMode]
  )

  return { displayMode, availableDisplayModes, requestDisplayMode }
}

function isSpecMode(
  mode: DisplayMode
): mode is (typeof SPEC_DISPLAY_MODES)[number] {
  return (SPEC_DISPLAY_MODES as readonly string[]).includes(mode)
}
