export function createDragExitTimer(onExit: () => void, delay = 500) {
  let timer: ReturnType<typeof setTimeout> | undefined
  function cancel() {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
  }
  return {
    cancel,
    update(outside: boolean) {
      if (!outside) {
        cancel()
        return
      }
      if (timer !== undefined) return
      timer = setTimeout(() => {
        timer = undefined
        onExit()
      }, delay)
    },
  }
}
