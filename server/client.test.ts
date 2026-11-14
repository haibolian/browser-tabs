import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import { createWorkspace } from '../src/lib/workspace'
import { createApp } from './app'
import { githubConfig, installGitHubFixture } from './testing/github-fixture'
import { codeChallenge, createSecret } from './auth'

const app = createApp({ databasePath: ':memory:', github: githubConfig })
let baseUrl: string
let CloudApi: typeof import('../src/lib/cloud-api').CloudApi
let fixture: ReturnType<typeof installGitHubFixture>
beforeAll(async () => {
  fixture = installGitHubFixture()
  baseUrl = await app.listen({ host: '127.0.0.1', port: 0 })
  vi.doMock('../src/lib/cloud-server', () => ({ CLOUD_SERVER_URL: baseUrl }))
  const clientModule = await import('../src/lib/cloud-api')
  CloudApi = clientModule.CloudApi
})
afterAll(async () => {
  await app.close()
  fixture.mockRestore()
  vi.doUnmock('../src/lib/cloud-server')
})

it('插件客户端通过真实 HTTP 完成 OAuth 握手、备份、恢复、删除和退出', async () => {
  const signIn = async () => {
    const api = new CloudApi()
    const verifier = createSecret()
    const start = await api.startGitHubLogin(githubConfig.returnUrls[0], codeChallenge(verifier))
    const callback = await fetch(
      `${baseUrl}/api/v1/auth/github/callback?state=${start.state}&code=alice`,
      { redirect: 'manual' },
    )
    expect(callback.status).toBe(302)
    return api.completeGitHubLogin(start.state, 'alice', verifier)
  }
  const session = await signIn()
  const client = new CloudApi(session)
  const backup = {
    format: 'blank-backup' as const,
    version: 1 as const,
    workspace: createWorkspace(),
    image: null,
  }
  const saved = await client.uploadBackup(backup)
  expect(await client.listBackups()).toEqual([saved])
  expect(await client.downloadBackup(saved.id)).toEqual(backup)
  await client.deleteBackup(saved.id)
  expect(await client.listBackups()).toEqual([])
  await expect(client.downloadBackup(saved.id)).rejects.toThrow('备份不存在')
  const deviceId = crypto.randomUUID()
  backup.workspace.widgetSizes = { todo: '2x3', notes: '2x3' }
  const automatic = await client.uploadBackup(backup, {
    requestId: crypto.randomUUID(),
    mode: 'automatic',
    deviceId,
  })
  backup.workspace.notes[0].content = 'updated automatically'
  const merged = await client.uploadBackup(backup, {
    requestId: crypto.randomUUID(),
    mode: 'automatic',
    deviceId,
  })
  expect(merged.id).toBe(automatic.id)
  expect(await client.downloadBackup(merged.id)).toEqual(backup)
  const manual = await client.uploadBackup(backup, {
    requestId: crypto.randomUUID(),
    mode: 'manual',
    deviceId,
  })
  expect(manual.id).not.toBe(automatic.id)
  expect(await client.listBackups()).toHaveLength(2)
  await expect(
    client.uploadBackup(backup, { requestId: crypto.randomUUID(), mode: 'automatic' }),
  ).rejects.toThrow('设备标识')
  await client.logout()
  await expect(client.listBackups()).rejects.toThrow('登录已失效')
  // Logout remains possible when another tab has already revoked this session.
  await client.logout()
  const signedIn = await signIn()
  expect(signedIn.user).toEqual(session.user)
})
