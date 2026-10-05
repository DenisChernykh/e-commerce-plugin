import axios, { type AxiosRequestConfig } from 'axios'

import {
  ApiNetworkError,
  ApiProblemError,
  ApiProtocolError,
  type ApiClientError,
  problemSchema,
} from './api-errors'

export type ErrorType<ErrorData> = ApiClientError & { response?: ErrorData }
export type BodyType<BodyData> = BodyData

export async function apiMutator<ResponseData>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig,
): Promise<ResponseData> {
  try {
    const response = await axios.request<ResponseData>({
      baseURL:
        typeof window === 'undefined'
          ? (process.env.API_BASE_URL ?? 'http://localhost:8787')
          : '',
      timeout: 15000,
      ...config,
      ...options,
      headers: {
        Accept: 'application/json',
        ...config.headers,
        ...options?.headers,
      },
    })
    if (!String(response.headers['content-type']).includes('application/json'))
      throw new ApiProtocolError()
    return response.data
  } catch (error) {
    if (axios.isCancel(error)) throw error
    if (error instanceof ApiProtocolError) throw error
    if (axios.isAxiosError(error)) {
      if (!error.response) throw new ApiNetworkError()
      const problem = problemSchema.safeParse(error.response.data)
      if (
        String(error.response.headers['content-type']).includes(
          'application/problem+json',
        ) &&
        problem.success &&
        problem.data.status === error.response.status
      )
        throw new ApiProblemError(problem.data)
    }
    throw new ApiProtocolError()
  }
}
