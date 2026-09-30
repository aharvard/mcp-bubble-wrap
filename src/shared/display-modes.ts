/**
 * Display modes the Bubble Wrap app declares support for.
 *
 * The MCP Apps spec (io.modelcontextprotocol/ui) defines three display modes.
 * Goose adds three host-specific modes on top of the spec. The app advertises
 * the full list to the host in its `ui/initialize` capabilities
 * (`appCapabilities.availableDisplayModes`); the host then offers only the
 * modes it also supports.
 *
 * This module is shared by the server (for logging/metadata) and the widget
 * bundle (for the capability declaration and display mode controls).
 */

import type { McpUiDisplayMode } from "@modelcontextprotocol/ext-apps"

/** Display modes defined by the MCP Apps specification. */
export const SPEC_DISPLAY_MODES = ["inline", "fullscreen", "pip"] as const

/**
 * Additional display modes supported by Goose. These are not part of the
 * MCP Apps spec; other hosts are expected to ignore them.
 */
export const GOOSE_DISPLAY_MODES = [
  "split-right",
  "split-bottom",
  "standalone",
] as const

/** Every display mode this app can render in. */
export const SUPPORTED_DISPLAY_MODES = [
  ...SPEC_DISPLAY_MODES,
  ...GOOSE_DISPLAY_MODES,
] as const

export type SpecDisplayMode = (typeof SPEC_DISPLAY_MODES)[number]
export type GooseDisplayMode = (typeof GOOSE_DISPLAY_MODES)[number]
export type DisplayMode = (typeof SUPPORTED_DISPLAY_MODES)[number]

/**
 * The SDK types `availableDisplayModes` as the spec enum only. Goose accepts
 * the extended list, so we widen the declared array to the SDK's type at the
 * one place it crosses into the SDK.
 */
export const DECLARED_DISPLAY_MODES =
  SUPPORTED_DISPLAY_MODES as unknown as McpUiDisplayMode[]

/** Human-readable labels for display mode controls. */
export const DISPLAY_MODE_LABELS: Record<DisplayMode, string> = {
  inline: "Inline",
  fullscreen: "Fullscreen",
  pip: "Picture-in-picture",
  "split-right": "Split right",
  "split-bottom": "Split bottom",
  standalone: "Standalone window",
}

export function isDisplayMode(value: unknown): value is DisplayMode {
  return (
    typeof value === "string" &&
    (SUPPORTED_DISPLAY_MODES as readonly string[]).includes(value)
  )
}
