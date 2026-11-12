import type { Workspace } from './workspace'
import type { BackupUpload, CloudBackup } from './cloud-contract'

export type CloudUploadJob = {
  id: string
  workspace: Workspace
  changedAt: number
  mode?: BackupUpload['mode']
  deviceId?: string
}
export type CloudUploadRecord = {
  pending: CloudUploadJob | null
  manual: CloudUploadJob[]
  lastUpload: CloudBackup | null
}

function nextJob(record: CloudUploadRecord) {
  return record.manual[0] ?? record.pending
}
export type CloudUploadState = {
  phase: 'idle' | 'waiting' | 'uploading' | 'saved' | 'error'
  lastUpload: CloudBackup | null
  error: string | null
}

export const uploadDebounceMs = 1200

type UploadDependencies = {
  load: () => Promise<CloudUploadRecord>
  upload: (job: CloudUploadJob, signal: AbortSignal) => Promise<CloudBackup>
  acknowledge: (job: CloudUploadJob, backup: CloudBackup) => Promise<void>
  exclusive: (task: () => Promise<void>, signal: AbortSignal) => Promise<void>
}

/** Serializes uploads of durable local edits. It never reads or restores a remote workspace. */
export class CloudUploader {
  private dependencies: UploadDependencies
  private state: CloudUploadState = { phase: 'idle', lastUpload: null, error: null }
  private listeners = new Set<() => void>()
  private running = false
  private timer: ReturnType<typeof setTimeout> | undefined
  private controller: AbortController | undefined
  private failedJob: string | undefined
  private revision = 0

  constructor(dependencies: UploadDependencies) {
    this.dependencies = dependencies
  }

  getSnapshot = () => this.state
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  private publish(state: CloudUploadState) {
    this.state = state
    for (const listener of this.listeners) listener()
  }
  start() {
    this.running = true
    void this.refresh()
  }
  stop() {
    this.running = false
    this.revision++
    clearTimeout(this.timer)
    this.controller?.abort()
  }
  refresh = async () => {
    if (!this.running || this.controller) return
    const revision = ++this.revision
    try {
      const record = await this.dependencies.load()
      if (!this.running || revision !== this.revision || this.controller) return
      clearTimeout(this.timer)
      const job = nextJob(record)
      if (!job) {
        this.failedJob = undefined
        this.publish({
          phase: record.lastUpload ? 'saved' : 'idle',
          lastUpload: record.lastUpload,
          error: null,
        })
      } else if (this.failedJob !== job.id) {
        this.failedJob = undefined
        this.publish({ phase: 'waiting', lastUpload: record.lastUpload, error: null })
        this.timer = setTimeout(
          () => void this.run(false),
          job.mode === 'manual' ? 0 : Math.max(0, job.changedAt + uploadDebounceMs - Date.now()),
        )
      }
    } catch (error) {
      if (this.running && revision === this.revision)
        this.publish({
          ...this.state,
          phase: 'error',
          error: `读取待上传内容失败：${(error as Error).message}`,
        })
    }
  }
  flush = () => {
    this.failedJob = undefined
    clearTimeout(this.timer)
    void this.run(true)
  }
  private async run(immediate: boolean) {
    if (!this.running || this.controller) return
    clearTimeout(this.timer)
    const controller = new AbortController()
    this.controller = controller
    let jobId: string | undefined
    let failed = false
    try {
      await this.dependencies.exclusive(async () => {
        const record = await this.dependencies.load()
        const job = nextJob(record)
        if (controller.signal.aborted || !job) return
        if (!immediate && job.mode !== 'manual' && job.changedAt + uploadDebounceMs > Date.now())
          return
        jobId = job.id
        this.publish({ phase: 'uploading', lastUpload: record.lastUpload, error: null })
        const backup = await this.dependencies.upload(job, controller.signal)
        if (controller.signal.aborted) return
        await this.dependencies.acknowledge(job, backup)
      }, controller.signal)
    } catch (error) {
      if (!controller.signal.aborted) {
        failed = true
        this.failedJob = jobId
        this.publish({
          ...this.state,
          phase: 'error',
          error: `云端上传失败：${(error as Error).message}`,
        })
      }
    } finally {
      this.controller = undefined
      if (this.running && (!failed || jobId)) void this.refresh()
    }
  }
}
