import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CloudApi,
  cloudUploadTarget,
  connectionKey,
  readCloudConnection,
  requestServerAccess,
  saveCloudConnection,
  type CloudConnection,
} from './cloud-api'
import { CLOUD_SERVER_URL } from './cloud-server'

function memoryStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  }
}

const connection: CloudConnection = {
  baseUrl: CLOUD_SERVER_URL,
  session: {
    token: 'test-session',
    expiresAt: Date.now() + 60_000,
    user: { id: 'user-1', githubId: '101', login: 'alice' },
  },
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage())
  vi.stubGlobal('sessionStorage', memoryStorage())
  vi.stubGlobal('window', new EventTarget())
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('固定云端备份服务', () => {
  it('保留固定服务器已有的登录信息和上传队列标识', () => {
    saveCloudConnection(connection)
    expect(readCloudConnection()).toEqual(connection)
    expect(cloudUploadTarget(connection)).toBe(JSON.stringify([CLOUD_SERVER_URL, '101']))
    saveCloudConnection(null)
    expect(readCloudConnection()).toBeNull()
  })

  it.each(['http://127.0.0.1:3001', 'https://other.example'])(
    '拒绝读取来自 %s 的旧会话',
    (baseUrl) => {
      localStorage.setItem(connectionKey, JSON.stringify({ ...connection, baseUrl }))
      expect(() => readCloudConnection()).toThrow('请重新使用 GitHub 登录')
    },
  )

  it('拒绝写入绑定其他服务器的会话', () => {
    const foreign = {
      ...connection,
      baseUrl: 'https://other.example',
    } as unknown as CloudConnection
    expect(() => saveCloudConnection(foreign)).toThrow()
    expect(localStorage.getItem(connectionKey)).toBeNull()
  })

  it('API 请求只发往内置地址，不读取本机缓存中的服务器地址', async () => {
    localStorage.setItem(
      connectionKey,
      JSON.stringify({ ...connection, baseUrl: 'https://other.example' }),
    )
    const fetchMock = vi.fn().mockResolvedValue(Response.json([]))
    vi.stubGlobal('fetch', fetchMock)
    await new CloudApi(connection.session).listBackups()
    expect(fetchMock).toHaveBeenCalledWith(
      `${CLOUD_SERVER_URL}/api/v1/backups`,
      expect.objectContaining({
        redirect: 'error',
        credentials: 'omit',
        headers: { Authorization: 'Bearer test-session' },
      }),
    )
  })

  it('插件登录只请求固定后端的站点权限', async () => {
    const request = vi.fn().mockResolvedValue(true)
    vi.stubGlobal('location', { protocol: 'chrome-extension:' })
    vi.stubGlobal('chrome', { permissions: { request } })
    await requestServerAccess()
    expect(request).toHaveBeenCalledWith({ origins: [`${CLOUD_SERVER_URL}/*`] })
    request.mockResolvedValue(false)
    await expect(requestServerAccess()).rejects.toThrow('需要允许访问')
  })

  it('不完成由旧服务器发起的 OAuth 登录请求', async () => {
    sessionStorage.setItem(
      'blank:github-authorization',
      JSON.stringify({
        baseUrl: 'https://other.example',
        state: 'state',
        codeVerifier: 'verifier',
        returnUrl: 'https://frontend.example/',
      }),
    )
    vi.stubGlobal('location', {
      href: 'https://frontend.example/#github_state=state&github_code=code',
      pathname: '/',
      search: '',
    })
    vi.stubGlobal('history', { replaceState: vi.fn() })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { completeGitHubRedirect } = await import('./github-login')
    await expect(completeGitHubRedirect()).rejects.toThrow('登录请求已失效')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(sessionStorage.getItem('blank:github-authorization')).toBeNull()
  })
})
