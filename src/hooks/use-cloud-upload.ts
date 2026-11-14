import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { CloudApi, cloudUploadTarget, type CloudConnection } from '@/lib/cloud-api'
import { CloudUploader, type CloudUploadState } from '@/lib/cloud-upload'
import {
  acknowledgeCloudUpload,
  createWorkspaceBackup,
  loadCloudUpload,
  saveWorkspace,
  subscribeCloudUploads,
} from '@/lib/storage'
import type { Workspace } from '@/lib/workspace'

const disconnected: CloudUploadState = { phase: 'idle', lastUpload: null, error: null }
const getDisconnected = () => disconnected
const noSubscription = () => () => {}

export function useCloudUpload(connection: CloudConnection | null) {
  const uploader = useMemo(() => {
    if (!connection) return null
    const target = cloudUploadTarget(connection)
    const api = new CloudApi(connection.session)
    return new CloudUploader({
      load: () => loadCloudUpload(target),
      upload: async (job, signal) =>
        api.uploadBackup(await createWorkspaceBackup(job.workspace), {
          requestId: job.id,
          mode: job.mode ?? 'manual',
          deviceId: job.deviceId,
          signal,
        }),
      acknowledge: (job, backup) => acknowledgeCloudUpload(target, job, backup),
      exclusive: async (task, signal) => {
        await navigator.locks.request(`blank:cloud-upload:${target}`, { signal }, task)
      },
    })
  }, [connection])
  const state = useSyncExternalStore(
    uploader?.subscribe ?? noSubscription,
    uploader?.getSnapshot ?? getDisconnected,
  )

  useEffect(() => {
    if (!uploader) return
    const unsubscribe = subscribeCloudUploads(() => {
      void uploader.refresh()
    })
    uploader.start()
    return () => {
      uploader.stop()
      unsubscribe()
    }
  }, [uploader])

  return {
    state,
    retry: () => uploader?.flush(),
    uploadNow: async (workspace: Workspace) => {
      if (!connection || !uploader) throw new Error('请先使用 GitHub 登录')
      await saveWorkspace(workspace, cloudUploadTarget(connection), 'manual')
      uploader.flush()
    },
  }
}

export type CloudUpload = ReturnType<typeof useCloudUpload>
