import { z } from 'zod'

export const problemSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string(),
  code: z.string(),
  instance: z.string(),
  requestId: z.string(),
})
export class ApiNetworkError extends Error {
  override name = 'ApiNetworkError'
  constructor() {
    super('Could not reach the catalog API')
  }
}
export class ApiProtocolError extends Error {
  override name = 'ApiProtocolError'
  constructor() {
    super('Unexpected API response')
  }
}
export class ApiProblemError extends Error {
  override name = 'ApiProblemError'
  readonly code: string
  readonly status: number
  readonly requestId: string
  constructor(problem: z.infer<typeof problemSchema>) {
    super(problem.code)
    this.code = problem.code
    this.status = problem.status
    this.requestId = problem.requestId
  }
}
export type ApiClientError =
  ApiNetworkError | ApiProtocolError | ApiProblemError
