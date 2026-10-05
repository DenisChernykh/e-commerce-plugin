import axios from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  ApiNetworkError,
  ApiProblemError,
  ApiProtocolError,
} from './api-errors'
import { apiMutator } from './orval-mutator'

afterEach(() => vi.restoreAllMocks())
describe('API transport', () => {
  it('preserves an abort signal and uses the same-origin browser API', async () => {
    const signal = new AbortController().signal
    const request = vi.spyOn(axios, 'request').mockResolvedValue({
      data: { items: [] },
      headers: { 'content-type': 'application/json' },
    })
    expect(await apiMutator({ url: '/api/products', signal })).toEqual({
      items: [],
    })
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/api/products', baseURL: '', signal }),
    )
  })
  it('distinguishes network errors from invalid HTML/proxy responses', async () => {
    vi.spyOn(axios, 'request')
      .mockRejectedValueOnce({ isAxiosError: true })
      .mockResolvedValueOnce({
        data: '<html>',
        headers: { 'content-type': 'text/html' },
      })
    await expect(apiMutator({ url: '/api/products' })).rejects.toBeInstanceOf(
      ApiNetworkError,
    )
    await expect(apiMutator({ url: '/api/products' })).rejects.toBeInstanceOf(
      ApiProtocolError,
    )
  })
  it('normalizes Problem Details without exposing server detail to UI', async () => {
    vi.spyOn(axios, 'request').mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 404,
        headers: { 'content-type': 'application/problem+json' },
        data: {
          type: 'urn:tiho:problem:not-found',
          title: 'Not found',
          status: 404,
          detail: 'internal server text',
          code: 'PRODUCT_NOT_FOUND',
          instance: '/api/products/missing',
          requestId: 'test-request',
        },
      },
    })
    await expect(
      apiMutator({ url: '/api/products/missing' }),
    ).rejects.toMatchObject({
      name: 'ApiProblemError',
      code: 'PRODUCT_NOT_FOUND',
      status: 404,
      message: 'PRODUCT_NOT_FOUND',
    })
    await expect(
      apiMutator({ url: '/api/products/missing' }),
    ).rejects.toBeInstanceOf(ApiProblemError)
  })
})
