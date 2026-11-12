import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CloudUploader,
  uploadDebounceMs,
  type CloudUploadJob,
  type CloudUploadRecord,
} from './cloud-upload'
import { createWorkspace } from './workspace'
import type { CloudBackup } from './cloud-contract'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
function metadata(job: CloudUploadJob): CloudBackup {
  return {
    id: `backup-${job.id}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    bytes: 100,
    todos: 2,
    notes: 2,
    sites: 9,
  }
}

describe('自动上传队列', () => {
  const uploaders: CloudUploader[] = []
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    for (const uploader of uploaders) uploader.stop()
    uploaders.length = 0
    vi.useRealTimers()
  })

  function setup() {
    const record: CloudUploadRecord = { pending: null, manual: [], lastUpload: null }
    const upload = vi.fn(async (job: CloudUploadJob, signal: AbortSignal) => {
      signal.throwIfAborted()
      return metadata(job)
    })
    const dependencies = {
      load: async () => ({ ...record }),
      upload,
      acknowledge: async (job: CloudUploadJob, backup: CloudBackup) => {
        if (record.pending?.id === job.id) record.pending = null
        record.manual = record.manual.filter((pending) => pending.id !== job.id)
        record.lastUpload = backup
      },
      exclusive: async (task: () => Promise<void>, signal: AbortSignal) => {
        signal.throwIfAborted()
        await task()
      },
    }
    const uploader = new CloudUploader(dependencies)
    uploaders.push(uploader)
    const edit = async (id: string) => {
      const workspace = createWorkspace()
      workspace.notes[0].content = id
      record.pending = { id, workspace, changedAt: Date.now() }
      await uploader.refresh()
    }
    return { uploader, record, upload, edit, dependencies }
  }

  it('只打开页面或登录不上传，也不自动读取远端工作区', async () => {
    const { uploader, upload } = setup()
    uploader.start()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(upload).not.toHaveBeenCalled()
    expect(uploader.getSnapshot().phase).toBe('idle')
  })

  it('合并连续编辑，停止编辑 1.2 秒后上传最新内容', async () => {
    const { uploader, edit, upload, record } = setup()
    uploader.start()
    await edit('first')
    await vi.advanceTimersByTimeAsync(800)
    await edit('latest')
    await vi.advanceTimersByTimeAsync(uploadDebounceMs - 1)
    expect(upload).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(upload).toHaveBeenCalledTimes(1)
    expect(upload.mock.calls[0][0].workspace.notes[0].content).toBe('latest')
    expect(record.pending).toBeNull()
    expect(uploader.getSnapshot().phase).toBe('saved')
  })

  it('上传过程中继续编辑，完成旧请求后再上传新版本且不并发', async () => {
    const { uploader, edit, upload, record } = setup()
    const first = deferred<CloudBackup>()
    upload.mockImplementationOnce(() => first.promise)
    uploader.start()
    await edit('first')
    await vi.advanceTimersByTimeAsync(uploadDebounceMs)
    await edit('second')
    await vi.advanceTimersByTimeAsync(uploadDebounceMs)
    expect(upload).toHaveBeenCalledTimes(1)
    first.resolve(metadata(upload.mock.calls[0][0]))
    await vi.advanceTimersByTimeAsync(1)
    expect(upload).toHaveBeenCalledTimes(2)
    expect(upload.mock.calls[1][0].id).toBe('second')
    expect(record.pending).toBeNull()
  })

  it('失败保留待上传记录并显示错误，手动重试使用原请求标识', async () => {
    const { uploader, edit, upload, record } = setup()
    upload.mockRejectedValueOnce(new Error('网络断开'))
    uploader.start()
    await edit('pending')
    await vi.advanceTimersByTimeAsync(uploadDebounceMs)
    expect(uploader.getSnapshot()).toMatchObject({
      phase: 'error',
      error: '云端上传失败：网络断开',
    })
    expect(record.pending?.id).toBe('pending')
    await vi.advanceTimersByTimeAsync(60_000)
    expect(upload).toHaveBeenCalledTimes(1)
    uploader.flush()
    await vi.advanceTimersByTimeAsync(1)
    expect(upload.mock.calls.map(([job]) => job.id)).toEqual(['pending', 'pending'])
    expect(uploader.getSnapshot().phase).toBe('saved')
  })

  it('旧版本失败时仍处理上传期间排入的新版本', async () => {
    const { uploader, edit, upload } = setup()
    const first = deferred<CloudBackup>()
    upload.mockImplementationOnce(() => first.promise)
    uploader.start()
    await edit('first')
    await vi.advanceTimersByTimeAsync(uploadDebounceMs)
    await edit('second')
    first.reject(new Error('旧请求断开'))
    await vi.advanceTimersByTimeAsync(uploadDebounceMs + 1)
    expect(upload.mock.calls.map(([job]) => job.id)).toEqual(['first', 'second'])
    expect(uploader.getSnapshot().phase).toBe('saved')
  })

  it('关闭页面或退出登录停止上传，重开后继续同一条待上传记录', async () => {
    const { uploader, edit, upload, dependencies } = setup()
    uploader.start()
    await edit('durable')
    uploader.stop()
    await vi.advanceTimersByTimeAsync(5000)
    expect(upload).not.toHaveBeenCalled()
    const reopened = new CloudUploader(dependencies)
    uploaders.push(reopened)
    reopened.start()
    await vi.advanceTimersByTimeAsync(1)
    expect(upload.mock.calls[0][0].id).toBe('durable')
    expect(reopened.getSnapshot().phase).toBe('saved')
  })

  it('退出时取消在途请求，不把未确认结果标记为已上传', async () => {
    const { uploader, edit, upload, record } = setup()
    const response = deferred<CloudBackup>()
    upload.mockImplementationOnce(() => response.promise)
    uploader.start()
    await edit('in-flight')
    await vi.advanceTimersByTimeAsync(uploadDebounceMs)
    uploader.stop()
    expect(upload.mock.calls[0][1].aborted).toBe(true)
    response.resolve(metadata(upload.mock.calls[0][0]))
    await vi.advanceTimersByTimeAsync(1)
    expect(record.pending?.id).toBe('in-flight')
    expect(record.lastUpload).toBeNull()
  })

  it('自动上传期间收到的手动备份单独上传，后续编辑不会覆盖它', async () => {
    const { uploader, edit, upload, record } = setup()
    const first = deferred<CloudBackup>()
    upload.mockImplementationOnce(() => first.promise)
    uploader.start()
    await edit('automatic-before')
    await vi.advanceTimersByTimeAsync(uploadDebounceMs)
    record.manual.push({
      id: 'manual',
      mode: 'manual',
      workspace: createWorkspace(),
      changedAt: Date.now(),
    })
    await edit('automatic-after')
    first.resolve(metadata(upload.mock.calls[0][0]))
    await vi.advanceTimersByTimeAsync(uploadDebounceMs + 1)
    expect(upload.mock.calls.map(([job]) => job.id)).toEqual([
      'automatic-before',
      'manual',
      'automatic-after',
    ])
    expect(record.manual).toEqual([])
    expect(record.pending).toBeNull()
  })
})
