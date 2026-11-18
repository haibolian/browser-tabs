import { useEffect, useId, useState } from 'react'
import { Github, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeDialog } from '@/components/ui/native-dialog'
import { CloudApi, type CloudConnection } from '@/lib/cloud-api'
import { signInWithGitHub } from '@/lib/github-login'
import { MCP_PUSH_URL, pushMcpConfig } from '@/lib/push-config'
import type { CreatedPushToken, PushToken } from '@/lib/push-contract'

export function PushSettings({ connection }: { connection: CloudConnection | null }) {
  const nameId = useId()
  const urlId = useId()
  const [tokens, setTokens] = useState<PushToken[]>([])
  const [name, setName] = useState('Codex')
  const [loading, setLoading] = useState(Boolean(connection))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<CreatedPushToken | null>(null)
  const [revoking, setRevoking] = useState<PushToken | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  useEffect(() => {
    if (!connection) return
    let alive = true
    async function load() {
      try {
        const items = await new CloudApi(connection!.session).listPushTokens()
        if (alive) setTokens(items)
      } catch (reason) {
        if (alive) setError((reason as Error).message)
      } finally {
        if (alive) setLoading(false)
      }
    }
    void load()
    return () => {
      alive = false
    }
  }, [connection])

  async function run(action: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (reason) {
      setError((reason as Error).message)
    } finally {
      setBusy(false)
    }
  }
  async function copy(value: string, target: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(target)
      setError(null)
    } catch {
      setError('复制失败，请手动复制')
    }
  }

  if (!connection)
    return (
      <div className="mt-4 space-y-3">
        <Button
          size="sm"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await signInWithGitHub()
            })
          }
        >
          <Github size={14} />
          使用 GitHub 登录
        </Button>
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
    )

  return (
    <div className="mt-4 space-y-6">
      <div className="space-y-2">
        <label htmlFor={urlId} className="text-xs font-medium">
          MCP 地址
        </label>
        <div className="flex items-center gap-2">
          <Input id={urlId} value={MCP_PUSH_URL} readOnly className="min-w-0 text-xs" />
          <Button size="sm" variant="outline" onClick={() => void copy(MCP_PUSH_URL, 'url')}>
            {copied === 'url' ? '已复制' : '复制'}
          </Button>
        </div>
      </div>
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault()
          void run(async () => {
            const result = await new CloudApi(connection.session).createPushToken(name.trim())
            setTokens((current) => [
              {
                id: result.id,
                name: result.name,
                suffix: result.suffix,
                createdAt: result.createdAt,
                lastUsedAt: result.lastUsedAt,
              },
              ...current,
            ])
            setCopied(null)
            setCreated(result)
          })
        }}
      >
        <label htmlFor={nameId} className="text-xs font-medium">
          令牌名称
        </label>
        <div className="flex items-center gap-2">
          <Input
            id={nameId}
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={80}
            className="min-w-0 text-xs"
          />
          <Button type="submit" size="sm" disabled={busy || loading || !name.trim()}>
            {busy && <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />}生成令牌
          </Button>
        </div>
      </form>
      {loading && (
        <LoaderCircle
          size={16}
          className="animate-spin text-muted-foreground"
          aria-label="读取令牌"
        />
      )}
      {tokens.length > 0 && (
        <ul className="divide-y divide-border">
          {tokens.map((token) => (
            <li key={token.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0 space-y-1">
                <div className="break-words text-xs font-medium">
                  {token.name}
                  <span className="ml-2 font-mono font-normal text-muted-foreground">
                    …{token.suffix}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {token.lastUsedAt
                    ? `最近推送：${new Date(token.lastUsedAt).toLocaleString()}`
                    : '尚未推送'}
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setError(null)
                  setRevoking(token)
                }}
              >
                撤销
              </Button>
            </li>
          ))}
        </ul>
      )}
      {error && !created && !revoking && (
        <p role="alert" className="break-words text-xs text-destructive">
          {error}
        </p>
      )}
      <NativeDialog
        open={created !== null}
        title="推送令牌"
        className="max-w-lg"
        onOpenChange={(open) => {
          if (!open) {
            setCreated(null)
            setError(null)
          }
        }}
      >
        <div className="min-h-0 space-y-4 overflow-y-auto">
          <p className="text-xs text-muted-foreground">令牌仅显示一次</p>
          <Input
            aria-label="推送令牌"
            value={created?.token ?? ''}
            readOnly
            className="font-mono text-xs"
            onFocus={(event) => event.target.select()}
          />
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (created) void copy(created.token, 'token')
              }}
            >
              {copied === 'token' ? '已复制' : '复制令牌'}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (created) void copy(pushMcpConfig(created.token), 'config')
              }}
            >
              {copied === 'config' ? '已复制' : '复制 MCP 配置'}
            </Button>
          </div>
        </div>
      </NativeDialog>
      <NativeDialog
        open={revoking !== null}
        title="撤销推送令牌？"
        className="max-w-lg"
        onOpenChange={(open) => {
          if (!open) {
            setRevoking(null)
            setError(null)
          }
        }}
      >
        <p className="text-sm">使用此令牌的推送将停止。</p>
        {error && (
          <p role="alert" className="mt-3 text-xs text-destructive">
            {error}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" disabled={busy} onClick={() => setRevoking(null)}>
            取消
          </Button>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                if (!revoking) return
                await new CloudApi(connection.session).revokePushToken(revoking.id)
                setTokens((current) => current.filter((token) => token.id !== revoking.id))
                setRevoking(null)
              })
            }
          >
            撤销
          </Button>
        </div>
      </NativeDialog>
    </div>
  )
}
