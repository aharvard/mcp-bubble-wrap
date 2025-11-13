import { z } from "zod"

/**
 * Structured content that the show_packing_slip tool returns
 * This ensures type safety between the MCP server and the UI component
 *
 * Extends Record<string, unknown> to satisfy MCP SDK requirements
 */
export interface PackingSlipStructuredContent extends Record<string, unknown> {
  timestamp?: string
}

/**
 * Zod schema for the structured content output
 * Use this in the MCP server's outputSchema
 */
export const packingSlipOutputSchema = z.object({
  timestamp: z.string().describe("Timestamp when the packing slip was shown"),
})

/**
 * Type inference from the Zod schema
 * This ensures the interface and schema stay in sync
 */
export type PackingSlipOutput = z.infer<typeof packingSlipOutputSchema>
