/** A hidden MCP panel can remain mounted. Visibility must include its iframe. */
export function observePageVisibility(listener: (visible: boolean) => void) {
  let intersects = !('IntersectionObserver' in window)
  const update = () =>
    listener(intersects && document.visibilityState === 'visible')
  const observer =
    'IntersectionObserver' in window
      ? new IntersectionObserver(([entry]) => {
          intersects = entry?.isIntersecting ?? false
          update()
        })
      : null
  observer?.observe(document.documentElement)
  document.addEventListener('visibilitychange', update)
  update()
  return () => {
    observer?.disconnect()
    document.removeEventListener('visibilitychange', update)
  }
}

/** Never overlap requests or keep polling a panel that the user cannot see. */
export function pollWhileVisible(
  operation: () => Promise<void>,
  delayMs: number,
) {
  let visible = false
  let disposed = false
  let running = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const run = async () => {
    clearTimeout(timer)
    if (disposed || !visible || running) return
    running = true
    try {
      await operation()
    } finally {
      running = false
      if (!disposed && visible)
        timer = setTimeout(() => {
          void run()
        }, delayMs)
    }
  }
  const stopVisibility = observePageVisibility((value) => {
    visible = value
    if (visible) void run()
    else clearTimeout(timer)
  })
  const focus = () => {
    void run()
  }
  window.addEventListener('focus', focus)
  return () => {
    disposed = true
    clearTimeout(timer)
    stopVisibility()
    window.removeEventListener('focus', focus)
  }
}
