import { z } from "zod"

/**
 * Structured content that the bubble_wrap tool returns
 * This ensures type safety between the MCP server and the UI component
 *
 * Extends Record<string, unknown> to satisfy MCP SDK requirements
 */
export interface BubbleWrapStructuredContent extends Record<string, unknown> {
  bubbleCount: number
}

/**
 * Zod schema for the structured content output
 * Use this in the MCP server's outputSchema
 */
export const bubbleWrapOutputSchema = z.object({
  bubbleCount: z.number().describe("Number of bubbles created"),
})

/**
 * Type inference from the Zod schema
 * This ensures the interface and schema stay in sync
 */
export type BubbleWrapOutput = z.infer<typeof bubbleWrapOutputSchema>

export interface BubbleState {
  id: number
  popped: boolean
}
