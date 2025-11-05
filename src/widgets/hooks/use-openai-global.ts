import { useSyncExternalStore } from "react"
import {
  SET_GLOBALS_EVENT_TYPE,
  SetGlobalsEvent,
  type OpenAiGlobals,
} from "./types"

export function useOpenAiGlobal<K extends keyof OpenAiGlobals>(
  key: K
): OpenAiGlobals[K] | null {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === "undefined") {
        return () => {}
      }

      console.log(`[useOpenAiGlobal] Subscribing to "${key}"`)
      console.log(`[useOpenAiGlobal] Initial window.openai:`, window.openai)
      console.log(
        `[useOpenAiGlobal] Initial value for "${key}":`,
        window.openai?.[key]
      )

      const handleSetGlobal = (event: SetGlobalsEvent) => {
        console.log(
          `[useOpenAiGlobal] Event received for "${key}":`,
          event.detail.globals
        )

        // Check if this key was updated in the event
        // Note: We check for the presence of the key, not if the value is defined
        if (key in event.detail.globals) {
          console.log(
            `[useOpenAiGlobal] "${key}" was updated to:`,
            event.detail.globals[key]
          )
          onChange()
        } else {
          console.log(`[useOpenAiGlobal] "${key}" was not in this update`)
        }
      }

      window.addEventListener(SET_GLOBALS_EVENT_TYPE, handleSetGlobal, {
        passive: true,
      })

      return () => {
        console.log(`[useOpenAiGlobal] Unsubscribing from "${key}"`)
        window.removeEventListener(SET_GLOBALS_EVENT_TYPE, handleSetGlobal)
      }
    },
    () => {
      const value = window.openai?.[key] ?? null
      console.log(`[useOpenAiGlobal] getSnapshot for "${key}":`, value)
      return value
    },
    () => window.openai?.[key] ?? null
  )
}
