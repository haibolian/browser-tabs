import { z } from 'zod'
import { backupSchema, type Backup } from './backup'
import { CLOUD_SERVER_URL } from './cloud-server'
import {
  cloudBackupListSchema,
  cloudBackupSchema,
  cloudSessionSchema,
  githubAuthorizationSchema,
  type CloudSession,
  type BackupUpload,
} from './cloud-contract'

type UploadRequest = Partial<BackupUpload> & { requestId: string; signal?: AbortSignal }

const connectionSchema = z.object({
  baseUrl: z.literal(CLOUD_SERVER_URL),
  session: cloudSessionSchema,
})
export type CloudConnection = z.infer<typeof connectionSchema>
export function cloudUploadTarget(connection: CloudConnection) {
  return JSON.stringify([CLOUD_SERVER_URL, connection.session.user.githubId])
}
export const connectionKey = 'blank:cloud-connection'
const connectionEvent = 'blank:cloud-connection-changed'

export function readCloudConnection() {
  const stored = localStorage.getItem(connectionKey)
  if (stored === null) return null
  const result = connectionSchema.safeParse(JSON.parse(stored))
  if (!result.success) throw new Error('本机登录信息已失效，请重新使用 GitHub 登录')
  return result.data
}

export function saveCloudConnection(connection: CloudConnection | null) {
  if (connection)
    localStorage.setItem(connectionKey, JSON.stringify(connectionSchema.parse(connection)))
  else localStorage.removeItem(connectionKey)
  window.dispatchEvent(new Event(connectionEvent))
}

export function subscribeCloudConnection(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === connectionKey || event.key === null) listener()
  }
  window.addEventListener(connectionEvent, listener)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(connectionEvent, listener)
    window.removeEventListener('storage', onStorage)
  }
}

// Called directly from the GitHub login gesture so MV3 can show its permission prompt.
export async function requestServerAccess() {
  if (location.protocol !== 'chrome-extension:') return
  const url = new URL(CLOUD_SERVER_URL)
  const granted = await chrome.permissions.request({
    origins: [`${url.protocol}//${url.hostname}/*`],
  })
  if (!granted) throw new Error('需要允许访问这个服务器，才能登录和保存云端备份')
}

export class CloudApi {
  private session?: CloudSession

  constructor(session?: CloudSession) {
    this.session = session
  }

  private async request(
    path: string,
    method = 'GET',
    body?: unknown,
    upload?: UploadRequest,
  ): Promise<unknown> {
    const response = await fetch(`${CLOUD_SERVER_URL}/api/v1${path}`, {
      method,
      credentials: 'omit',
      redirect: 'error',
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(this.session ? { Authorization: `Bearer ${this.session.token}` } : {}),
        ...(upload ? { 'Idempotency-Key': upload.requestId } : {}),
        ...(upload?.mode ? { 'X-Backup-Mode': upload.mode } : {}),
        ...(upload?.deviceId ? { 'X-Backup-Device': upload.deviceId } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: upload?.signal,
    })
    if (!response.ok) {
      if (!response.headers.get('content-type')?.includes('application/json'))
        throw new Error(`服务器返回 HTTP ${response.status}，响应格式错误`)
      const result: unknown = await response.json()
      const { error } = z.object({ error: z.string() }).parse(result)
      throw new Error(error)
    }
    if (
      response.status !== 204 &&
      !response.headers.get('content-type')?.includes('application/json')
    )
      throw new Error('服务器响应格式错误')
    return response.status === 204 ? undefined : response.json()
  }

  async startGitHubLogin(returnUrl: string, codeChallenge: string) {
    return githubAuthorizationSchema.parse(
      await this.request('/auth/github/start', 'POST', { returnUrl, codeChallenge }),
    )
  }

  async completeGitHubLogin(state: string, code: string, codeVerifier: string) {
    return cloudSessionSchema.parse(
      await this.request('/auth/github/complete', 'POST', { state, code, codeVerifier }),
    )
  }

  async logout() {
    await this.request('/auth/logout', 'POST')
  }

  async listBackups() {
    return cloudBackupListSchema.parse(await this.request('/backups'))
  }

  async uploadBackup(backup: Backup, upload?: UploadRequest) {
    return cloudBackupSchema.parse(await this.request('/backups', 'POST', backup, upload))
  }

  async downloadBackup(id: string) {
    return backupSchema.parse(await this.request(`/backups/${encodeURIComponent(id)}`))
  }

  async deleteBackup(id: string) {
    await this.request(`/backups/${encodeURIComponent(id)}`, 'DELETE')
  }
}
