/** Coalesces edits, serializes writes, and retains the latest snapshot after a failure. */
export class SaveQueue<T> {
  private pending: { value: T } | null = null
  private timer: ReturnType<typeof setTimeout> | undefined
  private running: Promise<void> | null = null
  private firstQueuedAt: number | null = null
  private write: (value: T) => Promise<void>
  private onSaved: (value: T) => void
  private onError: (error: unknown) => void
  private delay: number
  private maxWait: number

  constructor(
    write: (value: T) => Promise<void>,
    onSaved: (value: T) => void,
    onError: (error: unknown) => void,
    delay = 250,
    maxWait = 1000,
  ) {
    this.write = write
    this.onSaved = onSaved
    this.onError = onError
    this.delay = delay
    this.maxWait = maxWait
  }

  enqueue(value: T) {
    this.pending = { value }
    this.firstQueuedAt ??= Date.now()
    clearTimeout(this.timer)
    this.timer = setTimeout(
      () => void this.flush(),
      Math.max(0, Math.min(this.delay, this.maxWait - (Date.now() - this.firstQueuedAt))),
    )
  }

  flush(): Promise<void> {
    clearTimeout(this.timer)
    this.timer = undefined
    if (this.running) return this.running
    this.running = this.drain()
    return this.running
  }

  private async drain() {
    await Promise.resolve()
    try {
      while (this.pending) {
        clearTimeout(this.timer)
        const job = this.pending
        this.pending = null
        this.firstQueuedAt = null
        try {
          await this.write(job.value)
          this.onSaved(job.value)
        } catch (error) {
          if (!this.pending) {
            this.pending = job
            this.onError(error)
            break
          }
        }
      }
    } finally {
      this.running = null
    }
  }
}
