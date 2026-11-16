import { useEffect, useRef, useState } from 'react'
import { createWorkspace, type Workspace } from '@/lib/workspace'
import { loadWorkspace, saveWorkspace } from '@/lib/storage'
import { cloudUploadTarget, type CloudConnection } from '@/lib/cloud-api'
import { SaveQueue } from '@/lib/save-queue'

type Snapshot = { workspace: Workspace; target?: string }

export function useWorkspace(connection: CloudConnection | null) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedWorkspace, setSavedWorkspace] = useState<Workspace | null>(null)
  const previous = useRef<Workspace | null>(null)
  const latest = useRef<Snapshot | null>(null)
  const [queue] = useState(
    () =>
      new SaveQueue<Snapshot>(
        ({ workspace, target }) => saveWorkspace(workspace, target),
        (snapshot) => {
          setSaveError(null)
          setSavedWorkspace(snapshot.workspace)
        },
        (error) =>
          setSaveError(`保存失败：${error instanceof Error ? error.message : String(error)}`),
      ),
  )

  useEffect(() => {
    let alive = true
    async function load() {
      try {
        const saved = await loadWorkspace()
        if (alive) {
          setWorkspace(saved ?? createWorkspace())
          setLoadError(null)
        }
      } catch (error) {
        if (alive)
          setLoadError(
            `无法读取本地数据：${error instanceof Error ? error.message : String(error)}`,
          )
      }
    }
    void load()
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!workspace) return
    const changed = previous.current !== null && previous.current !== workspace
    previous.current = workspace
    const target = connection ? cloudUploadTarget(connection) : undefined
    const snapshot = {
      workspace,
      target: changed
        ? target
        : latest.current?.workspace === workspace && latest.current.target === target
          ? target
          : undefined,
    }
    latest.current = snapshot
    queue.enqueue(snapshot)
  }, [workspace, connection, queue])

  const saving = workspace !== savedWorkspace
  useEffect(() => {
    if (!saving && !saveError) return
    const flush = () => {
      void queue.flush()
    }
    const warnOnLeave = (event: BeforeUnloadEvent) => {
      flush()
      event.preventDefault()
    }
    const flushWhenHidden = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('beforeunload', warnOnLeave)
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', flushWhenHidden)
    return () => {
      window.removeEventListener('beforeunload', warnOnLeave)
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', flushWhenHidden)
    }
  }, [saving, saveError, queue])

  useEffect(
    () => () => {
      void queue.flush()
    },
    [queue],
  )

  return {
    workspace,
    setWorkspace,
    loadError,
    saveError,
    saving,
    retrySave: () => {
      void queue.flush()
    },
  }
}
