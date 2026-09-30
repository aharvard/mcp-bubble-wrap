/**
 * Transport shim that lets the ext-apps `App` talk to hosts offering display
 * modes beyond the spec enum (Goose: split-right, split-bottom, standalone).
 *
 * The SDK validates every host message against the spec schemas, and its
 * display-mode enum is exactly `inline | fullscreen | pip`. A host that puts
 * `"split-right"` in `hostContext.availableDisplayModes` therefore makes
 * `App.connect()` reject the whole `ui/initialize` result, and a granted
 * non-spec mode in a `ui/request-display-mode` result or a
 * `host-context-changed` notification is dropped the same way.
 *
 * This wrapper sits between the `PostMessageTransport` and the `App`:
 *
 * - Incoming messages are inspected first. The *real* display mode values are
 *   recorded on {@link DisplayModeCompatTransport.hostModes} and surfaced via
 *   {@link DisplayModeCompatTransport.onhostmodeschanged}.
 * - The copy handed to the `App` is sanitised so it passes schema validation:
 *   non-spec entries are removed from `availableDisplayModes` and a non-spec
 *   `displayMode` is replaced with `"fullscreen"` (the closest spec mode: a
 *   fixed viewport the app must fill).
 *
 * Everything else is forwarded untouched, so this is a no-op for spec-only
 * hosts such as the ext-apps reference host or ChatGPT.
 */

import type {
  JSONRPCMessage,
  RequestId,
  Transport,
} from "@modelcontextprotocol/client"
import {
  SPEC_DISPLAY_MODES,
  isDisplayMode,
  type DisplayMode,
  type SpecDisplayMode,
} from "../../shared/display-modes"

export interface HostDisplayModes {
  /** Mode the host is actually rendering us in, including non-spec values. */
  displayMode?: DisplayMode
  /** Modes the host actually offers, including non-spec values. */
  availableDisplayModes?: DisplayMode[]
  /** Mode granted by the most recent `ui/request-display-mode`. */
  lastGrantedMode?: DisplayMode
}

const SPEC_FALLBACK: SpecDisplayMode = "fullscreen"

function isSpecMode(value: unknown): value is SpecDisplayMode {
  return (SPEC_DISPLAY_MODES as readonly unknown[]).includes(value)
}

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export class DisplayModeCompatTransport implements Transport {
  readonly hostModes: HostDisplayModes = {}

  /** Fires whenever the host reports a (possibly non-spec) display mode value. */
  onhostmodeschanged?: (modes: HostDisplayModes) => void

  onclose?: () => void
  onerror?: (error: Error) => void
  onmessage?: Transport["onmessage"]

  private readonly pendingDisplayModeRequests = new Set<string>()

  constructor(private readonly inner: Transport) {}

  get sessionId() {
    return this.inner.sessionId
  }

  setProtocolVersion?(version: string): void {
    this.inner.setProtocolVersion?.(version)
  }

  async start(): Promise<void> {
    this.inner.onclose = () => this.onclose?.()
    this.inner.onerror = (error) => this.onerror?.(error)
    this.inner.onmessage = (message, extra) => {
      this.onmessage?.(this.sanitizeIncoming(message), extra)
    }
    await this.inner.start()
  }

  async send(
    message: JSONRPCMessage,
    options?: Parameters<Transport["send"]>[1]
  ): Promise<void> {
    if (
      "method" in message &&
      message.method === "ui/request-display-mode" &&
      "id" in message
    ) {
      this.pendingDisplayModeRequests.add(String(message.id as RequestId))
    }
    await this.inner.send(message, options)
  }

  async close(): Promise<void> {
    await this.inner.close()
  }

  // ---------------------------------------------------------------------------

  private sanitizeIncoming(message: JSONRPCMessage): JSONRPCMessage {
    // ui/initialize result: { hostInfo, hostCapabilities, hostContext }
    if (
      "result" in message &&
      isRecord(message.result) &&
      isRecord(message.result.hostContext) &&
      "hostInfo" in message.result
    ) {
      const hostContext = this.sanitizeHostContext(message.result.hostContext)
      return {
        ...message,
        result: { ...message.result, hostContext },
      } as JSONRPCMessage
    }

    // ui/request-display-mode result: { mode }
    if (
      "result" in message &&
      "id" in message &&
      this.pendingDisplayModeRequests.delete(String(message.id as RequestId)) &&
      isRecord(message.result)
    ) {
      const granted = message.result.mode
      if (isDisplayMode(granted)) {
        this.update({ lastGrantedMode: granted, displayMode: granted })
        if (!isSpecMode(granted)) {
          return {
            ...message,
            result: { ...message.result, mode: SPEC_FALLBACK },
          } as JSONRPCMessage
        }
      }
      return message
    }

    // ui/notifications/host-context-changed: params is a partial host context
    if (
      "method" in message &&
      message.method === "ui/notifications/host-context-changed" &&
      isRecord(message.params)
    ) {
      return {
        ...message,
        params: this.sanitizeHostContext(message.params),
      } as JSONRPCMessage
    }

    return message
  }

  private sanitizeHostContext(context: UnknownRecord): UnknownRecord {
    const next: UnknownRecord = { ...context }
    const update: HostDisplayModes = {}

    if (Array.isArray(context.availableDisplayModes)) {
      const offered = context.availableDisplayModes.filter(isDisplayMode)
      update.availableDisplayModes = offered
      next.availableDisplayModes = offered.filter(isSpecMode)
    }

    if (typeof context.displayMode === "string") {
      if (isDisplayMode(context.displayMode)) {
        update.displayMode = context.displayMode
      }
      if (!isSpecMode(context.displayMode)) {
        next.displayMode = SPEC_FALLBACK
      }
    }

    if (Object.keys(update).length > 0) this.update(update)
    return next
  }

  private update(patch: HostDisplayModes) {
    Object.assign(this.hostModes, patch)
    this.onhostmodeschanged?.({ ...this.hostModes })
  }
}
