/**
 * Hook to access OpenAI global data injected by the Apps SDK
 */
export function useOpenAiGlobal<T = unknown>(key: string): T | null {
  if (typeof window === "undefined") return null

  const w = window as any

  // Check for OpenAI global object
  if (w.openai && typeof w.openai === "object") {
    return (w.openai[key] as T) ?? null
  }

  return null
}
