import { useOpenAiGlobal } from "./use-openai-global.js"

/**
 * Hook to get widget props from the Apps SDK or use default values
 */
export function useWidgetProps<T extends Record<string, unknown>>(
  defaultState?: T | (() => T)
): T {
  const props = useOpenAiGlobal<T>("toolOutput")

  const fallback =
    typeof defaultState === "function"
      ? (defaultState as () => T | null)()
      : (defaultState ?? null)

  return props ?? (fallback as T)
}
