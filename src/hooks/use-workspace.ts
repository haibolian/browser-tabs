import { useEffect, useRef, useState } from 'react'
import { createWorkspace, type Workspace } from '@/lib/workspace'
import { loadWorkspace, saveWorkspace } from '@/lib/storage'
import { cloudUploadTarget, type CloudConnection } from '@/lib/cloud-api'

export function useWorkspace(connection: CloudConnection | null) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedWorkspace, setSavedWorkspace] = useState<Workspace | null>(null)
  const [retry, setRetry] = useState(0)
  const revision = useRef(0)
  const previousWorkspace = useRef<Workspace | null>(null)
  const pendingChange = useRef<Workspace | null>(null)

  useEffect(() => {
    let alive = true
    loadWorkspace()
      .then((saved) => {
        if (alive) {
          setWorkspace(saved ?? createWorkspace())
          setLoadError(null)
        }
      })
      .catch((error: Error) => {
        if (alive) setLoadError(`无法读取本地数据：${error.message}`)
      })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!workspace) return
    if (
      previousWorkspace.current &&
      JSON.stringify(previousWorkspace.current) !== JSON.stringify(workspace)
    )
      pendingChange.current = workspace
    previousWorkspace.current = workspace
    const current = ++revision.current
    const target =
      pendingChange.current === workspace && connection ? cloudUploadTarget(connection) : undefined
    saveWorkspace(workspace, target)
      .then(() => {
        if (revision.current === current) {
          if (pendingChange.current === workspace) pendingChange.current = null
          setSaveError(null)
          setSavedWorkspace(workspace)
        }
      })
      .catch((error: Error) => {
        if (revision.current === current) setSaveError(`保存失败：${error.message}`)
      })
  }, [workspace, retry, connection])

  const saving = workspace !== savedWorkspace && !saveError

  useEffect(() => {
    const warnOnLeave = (event: BeforeUnloadEvent) => {
      if (saving || saveError) event.preventDefault()
    }
    window.addEventListener('beforeunload', warnOnLeave)
    return () => window.removeEventListener('beforeunload', warnOnLeave)
  }, [saving, saveError])

  return {
    workspace,
    setWorkspace,
    loadError,
    saveError,
    saving,
    retrySave: () => setRetry((value) => value + 1),
  }
}
