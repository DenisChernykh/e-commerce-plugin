import type { z } from 'zod'
import type {
  paramsSchema,
  selectionSchema,
  searchOutput,
  productOutput,
  productsOutput,
} from '../../../../chatgpt/src/schemas'

export type CatalogParams = z.infer<typeof paramsSchema>
export type CatalogSelection = z.infer<typeof selectionSchema>
export type CatalogResult = z.infer<typeof searchOutput>
export type ProductResult = z.infer<typeof productOutput>
export type ComparisonResult = z.infer<typeof productsOutput>
export type CatalogData = CatalogResult | ProductResult | ComparisonResult
export type ToolResult = {
  _meta?: Record<string, unknown>
  isError?: boolean
  structuredContent?: Record<string, unknown>
  content?: { type: string; text?: string }[]
}
export type CatalogBridge = {
  callTool: (name: string, args: Record<string, unknown>) => Promise<ToolResult>
  publishContext: (context: Record<string, unknown>) => Promise<unknown>
  persist?: (state: unknown) => void
  openLink: (url: string) => Promise<unknown>
  fullscreen?: () => Promise<unknown>
}
