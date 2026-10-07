import { afterEach, expect, it, vi } from 'vitest'
import { pollWhileVisible } from './visible-polling'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
it('pauses hidden panels and never overlaps a slow server request', async () => {
  vi.useFakeTimers()
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  let visibility!: (visible: boolean) => void
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
        visibility = (visible) => callback([{ isIntersecting: visible }])
      }
      observe() {}
      disconnect() {}
    },
  )
  let complete!: () => void
  const operation = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          complete = resolve
        }),
    )
    .mockResolvedValue(undefined)
  const stop = pollWhileVisible(operation, 1000)
  await vi.advanceTimersByTimeAsync(5000)
  expect(operation).not.toHaveBeenCalled()
  visibility(true)
  await vi.advanceTimersByTimeAsync(5000)
  window.dispatchEvent(new Event('focus'))
  expect(operation).toHaveBeenCalledTimes(1)
  complete()
  await vi.advanceTimersByTimeAsync(1000)
  expect(operation).toHaveBeenCalledTimes(2)
  visibility(false)
  await vi.advanceTimersByTimeAsync(5000)
  expect(operation).toHaveBeenCalledTimes(2)
  visibility(true)
  expect(operation).toHaveBeenCalledTimes(3)
  stop()
  await vi.advanceTimersByTimeAsync(5000)
  expect(operation).toHaveBeenCalledTimes(3)
})
