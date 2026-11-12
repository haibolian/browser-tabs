import { useEffect, useState } from 'react'
import { Cloud, Github, LoaderCircle, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CloudApi, saveCloudConnection, type CloudConnection } from '@/lib/cloud-api'
import type { CloudBackup } from '@/lib/cloud-contract'
import { signInWithGitHub } from '@/lib/github-login'
import { importWorkspace } from '@/lib/storage'
import type { CloudUpload } from '@/hooks/use-cloud-upload'
import { CloudUploadStatus } from '@/components/cloud-upload-status'
import type { ImportedBackup } from '@/lib/infinity-backup'
import type { Workspace } from '@/lib/workspace'

export function CloudBackupPanel({
  workspace,
  onRestore,
  connection,
  connectionError,
  cloudUpload,
}: {
  workspace: Workspace
  onRestore: (backup: ImportedBackup) => void
  connection: CloudConnection | null
  connectionError: string | null
  cloudUpload: CloudUpload
}) {
  const [baseUrl, setBaseUrl] = useState(connection?.baseUrl ?? 'http://127.0.0.1:3001')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [backups, setBackups] = useState<CloudBackup[] | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [pendingDelete, setPendingDelete] = useState<CloudBackup | null>(null)
  const [loadedConnection, setLoadedConnection] = useState<CloudConnection | null>(null)

  useEffect(() => {
    if (!connection) return
    let alive = true
    const api = new CloudApi(connection.baseUrl, connection.session)
    api.listBackups().then(
      (items) => {
        if (alive) {
          setBackups(items)
          setError(null)
          setLoadedConnection(connection)
        }
      },
      (reason: Error) => {
        if (alive) {
          setError(`读取云端备份失败：${reason.message}`)
          setLoadedConnection(connection)
        }
      },
    )
    return () => {
      alive = false
    }
  }, [
    connection,
    refresh,
    cloudUpload.state.lastUpload?.id,
    cloudUpload.state.lastUpload?.updatedAt,
  ])

  const loading = connection !== loadedConnection
  const disabled = busy || loading

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  function api() {
    if (!connection) throw new Error('请先登录')
    return new CloudApi(connection.baseUrl, connection.session)
  }

  return (
    <section className="mt-6 border-t border-border pt-5" aria-label="云端备份">
      <h3 className="flex items-center gap-2 text-xs font-medium">
        <Cloud size={14} className="text-primary/60" />
        云端备份
        {(busy || loading) && (
          <LoaderCircle size={14} className="animate-spin" aria-label="处理中" />
        )}
      </h3>
      {!connection ? (
        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            void run(async () => {
              await signInWithGitHub(baseUrl)
            })
          }}
        >
          <label className="block space-y-1.5 text-xs">
            <span>服务器地址</span>
            <Input
              type="url"
              required
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              disabled={busy}
            />
          </label>
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={busy}>
              <Github size={14} /> 使用 GitHub 登录
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="rounded-xl bg-primary/4 p-3 text-xs">
            <p className="flex items-center gap-2 break-all font-medium">
              <Github size={14} />@{connection.session.user.login}
            </p>
          </div>
          <CloudUploadStatus state={cloudUpload.state} />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={disabled || cloudUpload.state.phase === 'uploading'}
              onClick={() =>
                void run(async () => {
                  await cloudUpload.uploadNow(workspace)
                })
              }
            >
              立即上传
            </Button>
            {cloudUpload.state.phase === 'error' && (
              <Button variant="outline" size="sm" onClick={cloudUpload.retry}>
                重试上传
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => {
                setLoadedConnection(null)
                setRefresh((value) => value + 1)
              }}
            >
              <RefreshCw size={13} />
              刷新
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await api().logout()
                  saveCloudConnection(null)
                  setLoadedConnection(null)
                  setBackups(null)
                })
              }
            >
              退出登录
            </Button>
          </div>
          {backups?.length === 0 && (
            <p className="py-3 text-xs text-muted-foreground">暂无云端备份</p>
          )}
          {!!backups?.length && (
            <ul className="max-h-72 space-y-2 overflow-y-auto">
              {backups.map((backup) => (
                <li key={backup.id} className="rounded-xl border border-border p-3">
                  <div className="text-xs">{new Date(backup.updatedAt).toLocaleString()}</div>
                  <div className="mt-1 text-[10px] leading-5 text-muted-foreground">
                    {backup.sites} 个网站 · {backup.todos} 项待办 · {backup.notes} 篇备忘 ·{' '}
                    {(backup.bytes / 1024).toFixed(1)} KB
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={disabled}
                      onClick={() =>
                        void run(async () => {
                          const saved = await api().downloadBackup(backup.id)
                          onRestore(await importWorkspace(JSON.stringify(saved)))
                        })
                      }
                    >
                      拉取并恢复
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="删除这份云端备份"
                      disabled={disabled}
                      onClick={() => setPendingDelete(backup)}
                    >
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {(error || connectionError) && (
        <div role="alert" className="mt-3 space-y-2 text-xs leading-5 text-destructive">
          <p className="break-words">{error || connectionError}</p>
          {(connection || connectionError) && (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  saveCloudConnection(null)
                  setLoadedConnection(null)
                  setBackups(null)
                  toast('已清除本机登录信息')
                })
              }
            >
              清除本机登录信息
            </Button>
          )}
        </div>
      )}
      <Dialog
        open={!!pendingDelete}
        onOpenChange={(open) => {
          if (!open && !busy) setPendingDelete(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除这份云端备份？</DialogTitle>
            <DialogDescription>删除后无法恢复。</DialogDescription>
          </DialogHeader>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" disabled={busy} onClick={() => setPendingDelete(null)}>
              取消
            </Button>
            <Button
              disabled={busy}
              onClick={() => {
                const target = pendingDelete!
                setPendingDelete(null)
                void run(async () => {
                  await api().deleteBackup(target.id)
                  setBackups((items) => items!.filter((item) => item.id !== target.id))
                  toast('云端备份已删除')
                })
              }}
            >
              删除备份
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
