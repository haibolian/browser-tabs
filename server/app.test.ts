import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createWorkspace } from '../src/lib/workspace'
import type { Backup } from '../src/lib/backup'
import { createApp } from './app'
import { githubConfig, githubSignIn, installGitHubFixture } from './testing/github-fixture'

const makeBackup = (): Backup => ({
  format: 'blank-backup',
  version: 1,
  workspace: createWorkspace(),
  image: null,
})

describe('账号与云端备份 API', () => {
  let app: ReturnType<typeof createApp>
  let fixture: ReturnType<typeof installGitHubFixture>
  beforeEach(() => {
    fixture = installGitHubFixture()
    app = createApp({ databasePath: ':memory:', github: githubConfig })
  })
  afterEach(async () => {
    await app.close()
    fixture.mockRestore()
  })

  async function register(login = 'alice') {
    return githubSignIn(app, login)
  }

  it('GitHub 登录、重新登录和退出使用真实会话，不向客户端返回 GitHub 令牌', async () => {
    const { session, headers } = await register()
    expect(session.user.login).toBe('alice')
    expect(Object.keys(session.user).sort()).toEqual(['githubId', 'id', 'login'])
    expect(JSON.stringify(session)).not.toContain('provider-token')
    const me = await app.inject({ url: '/api/v1/auth/me', headers })
    expect(me.json()).toEqual(session.user)
    expect(me.headers['cache-control']).toBe('no-store')

    const login = await register()
    expect(login.session.token).not.toBe(session.token)
    expect(login.session.user).toEqual(session.user)
    const logout = await app.inject({ method: 'POST', url: '/api/v1/auth/logout', headers })
    expect(logout.statusCode).toBe(204)
    expect((await app.inject({ url: '/api/v1/backups', headers })).statusCode).toBe(401)
    expect(
      (
        await app.inject({
          url: '/api/v1/backups',
          headers: login.headers,
        })
      ).statusCode,
    ).toBe(200)
  })

  it('拒绝未登录及伪造会话访问', async () => {
    for (const headers of [{}, { authorization: 'Bearer forged-token' }]) {
      expect((await app.inject({ url: '/api/v1/backups', headers })).statusCode).toBe(401)
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/backups',
            headers,
            payload: makeBackup(),
          })
        ).statusCode,
      ).toBe(401)
    }
  })

  it('完整往返工作区、图标与壁纸，并按账号隔离读取和删除', async () => {
    const alice = await register('alice')
    const bob = await register('bob')
    const backup = makeBackup()
    backup.workspace.settings.wallpaper = 'uploaded'
    backup.workspace.settings.imageId = 'wallpaper-original'
    backup.image =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGbkAAAAASUVORK5CYII='
    const shortcut = backup.workspace.items[0]
    if (shortcut.kind !== 'shortcut') throw new Error('Expected shortcut')
    shortcut.iconSource = 'upload'
    shortcut.uploadedIcon = backup.image
    const uploaded = await app.inject({
      method: 'POST',
      url: '/api/v1/backups',
      headers: alice.headers,
      payload: backup,
    })
    expect(uploaded.statusCode).toBe(201)
    const metadata = uploaded.json()
    expect(metadata).toMatchObject({ todos: 2, notes: 2, sites: 9 })
    expect(metadata.bytes).toBe(Buffer.byteLength(JSON.stringify(backup)))
    const url = `/api/v1/backups/${metadata.id}`
    expect((await app.inject({ url, headers: alice.headers })).json()).toEqual(backup)
    expect((await app.inject({ url: '/api/v1/backups', headers: alice.headers })).json()).toEqual([
      metadata,
    ])
    expect((await app.inject({ url: '/api/v1/backups', headers: bob.headers })).json()).toEqual([])
    expect((await app.inject({ url, headers: bob.headers })).statusCode).toBe(404)
    expect((await app.inject({ method: 'DELETE', url, headers: bob.headers })).statusCode).toBe(404)
    expect((await app.inject({ url, headers: alice.headers })).statusCode).toBe(200)
    expect((await app.inject({ method: 'DELETE', url, headers: alice.headers })).statusCode).toBe(
      204,
    )
    expect((await app.inject({ url, headers: alice.headers })).statusCode).toBe(404)
  })

  it('拒绝损坏的工作区和缺失壁纸，不写入备份记录', async () => {
    const { headers } = await register()
    const backup = makeBackup()
    backup.workspace.settings.imageId = 'missing-image'
    expect(
      (await app.inject({ method: 'POST', url: '/api/v1/backups', headers, payload: backup }))
        .statusCode,
    ).toBe(400)
    const invalidSite = makeBackup()
    const shortcut = invalidSite.workspace.items[0]
    if (shortcut.kind === 'shortcut') shortcut.url = 'javascript:alert(1)'
    expect(
      (await app.inject({ method: 'POST', url: '/api/v1/backups', headers, payload: invalidSite }))
        .statusCode,
    ).toBe(400)
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/v1/backups',
          headers: { ...headers, 'content-type': 'application/json' },
          payload: '{',
        })
      ).statusCode,
    ).toBe(400)
    expect((await app.inject({ url: '/api/v1/backups', headers })).json()).toEqual([])
  })

  it('保存超过框架默认 1 MiB 的真实内容，不截断备忘', async () => {
    const { headers } = await register()
    const backup = makeBackup()
    backup.workspace.notes[0].content = '长文本内容'.repeat(100_000)
    const uploaded = await app.inject({
      method: 'POST',
      url: '/api/v1/backups',
      headers,
      payload: backup,
    })
    expect(uploaded.statusCode).toBe(201)
    const restored = await app.inject({ url: `/api/v1/backups/${uploaded.json().id}`, headers })
    expect(restored.json()).toEqual(backup)
  })

  it('并发上传创建独立快照，不覆盖已有数据', async () => {
    const { headers } = await register()
    const responses = await Promise.all(
      [0, 1, 2].map(async (index) => {
        const backup = makeBackup()
        backup.workspace.notes[0].title = `版本 ${index}`
        return app.inject({ method: 'POST', url: '/api/v1/backups', headers, payload: backup })
      }),
    )
    expect(responses.every((response) => response.statusCode === 201)).toBe(true)
    expect(new Set(responses.map((response) => response.json().id)).size).toBe(3)
    expect((await app.inject({ url: '/api/v1/backups', headers })).json()).toHaveLength(3)
  })

  it('重复上传同一请求只创建一份备份，拒绝同一请求标识对应不同内容，且按账号隔离', async () => {
    const alice = await register('alice')
    const bob = await register('bob')
    const key = crypto.randomUUID()
    const backup = makeBackup()
    const headers = { ...alice.headers, 'idempotency-key': key }
    const [first, second] = await Promise.all(
      [0, 1].map(() =>
        app.inject({ method: 'POST', url: '/api/v1/backups', headers, payload: backup }),
      ),
    )
    expect(first.statusCode).toBe(201)
    expect(second.json()).toEqual(first.json())
    expect(
      (await app.inject({ url: '/api/v1/backups', headers: alice.headers })).json(),
    ).toHaveLength(1)
    const changed = makeBackup()
    changed.workspace.todos = []
    expect(
      (await app.inject({ method: 'POST', url: '/api/v1/backups', headers, payload: changed }))
        .statusCode,
    ).toBe(409)
    const other = await app.inject({
      method: 'POST',
      url: '/api/v1/backups',
      headers: { ...bob.headers, 'idempotency-key': key },
      payload: backup,
    })
    expect(other.statusCode).toBe(201)
    expect(other.json().id).not.toBe(first.json().id)
  })

  it('允许扩展携带 Bearer 认证跨域访问，不依赖 Cookie', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/api/v1/backups',
      headers: {
        origin: 'chrome-extension://abcdefghijklmnopabcdefghijklmnop',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'authorization,content-type',
      },
    })
    expect(response.statusCode).toBe(204)
    expect(response.headers['access-control-allow-origin']).toBe('*')
    expect(response.headers['access-control-allow-headers']).toContain('authorization')
    expect(response.headers['access-control-allow-credentials']).toBeUndefined()
  })
})

it('SQLite 文件在服务重启后保留账号、会话和完整备份', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'blank-backup-test-'))
  const databasePath = join(directory, 'backup.sqlite')
  const fixture = installGitHubFixture()
  let app = createApp({ databasePath, github: githubConfig })
  try {
    const { headers } = await githubSignIn(app)
    const backup = makeBackup()
    const uploaded = await app.inject({
      method: 'POST',
      url: '/api/v1/backups',
      headers,
      payload: backup,
    })
    expect(uploaded.statusCode).toBe(201)
    await app.close()
    app = createApp({ databasePath, github: githubConfig })
    expect(
      (await app.inject({ url: `/api/v1/backups/${uploaded.json().id}`, headers })).json(),
    ).toEqual(backup)
    const renamed = await githubSignIn(app, 'alice-renamed')
    expect(
      (await app.inject({ url: '/api/v1/backups', headers: renamed.headers })).json(),
    ).toHaveLength(1)
  } finally {
    await app.close()
    fixture.mockRestore()
    rmSync(directory, { recursive: true })
  }
})
