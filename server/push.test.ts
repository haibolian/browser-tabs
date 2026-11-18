import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'node:crypto'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from './app'
import { githubConfig, githubSignIn, installGitHubFixture } from './testing/github-fixture'
import { PushStore } from './push'
import { migrateDatabase } from './migrations'
import { hashToken } from './auth'

describe('推送令牌与未读消息', () => {
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
  async function setup(login = 'alice') {
    const user = await githubSignIn(app, login)
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/push/tokens',
      headers: user.headers,
      payload: { name: 'Codex' },
    })
    expect(response.statusCode).toBe(201)
    const created = response.json()
    return { ...user, created, pushHeaders: { authorization: `Bearer ${created.token}` } }
  }
  const content = { title: '日报', content: '完整的推送结果', requestId: 'daily-2026-11-18' }

  it('完整投递、已读与账号隔离，推送令牌不能读取消息或访问备份', async () => {
    const alice = await setup()
    const bob = await setup('bob')
    const listed = await app.inject({ url: '/api/v1/push/tokens', headers: alice.headers })
    expect(listed.json()[0].token).toBeUndefined()
    expect(listed.json()[0].token_hash).toBeUndefined()
    for (const url of ['/api/v1/push/messages', '/api/v1/push/tokens', '/api/v1/backups'])
      expect((await app.inject({ url, headers: alice.pushHeaders })).statusCode).toBe(401)
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/v1/push/messages',
          headers: alice.headers,
          payload: content,
        })
      ).statusCode,
    ).toBe(401)
    const sent = await app.inject({
      method: 'POST',
      url: '/api/v1/push/messages',
      headers: alice.pushHeaders,
      payload: content,
    })
    expect(sent.statusCode).toBe(201)
    const unread = () => app.inject({ url: '/api/v1/push/messages', headers: alice.headers })
    expect((await unread()).json()[0]).toMatchObject({
      title: content.title,
      content: content.content,
      readAt: null,
    })
    expect(
      (await app.inject({ url: '/api/v1/push/messages', headers: bob.headers })).json(),
    ).toEqual([])
    const markRead = (headers: typeof alice.headers) =>
      app.inject({
        method: 'POST',
        url: '/api/v1/push/messages/read',
        headers,
        payload: { ids: [sent.json().id] },
      })
    expect((await markRead(bob.headers)).statusCode).toBe(204)
    expect((await unread()).json()).toHaveLength(1)
    expect((await markRead(alice.headers)).statusCode).toBe(204)
    expect((await unread()).json()).toEqual([])
    expect((await markRead(alice.headers)).statusCode).toBe(204)
    const retry = await app.inject({
      method: 'POST',
      url: '/api/v1/push/messages',
      headers: alice.pushHeaders,
      payload: content,
    })
    expect(retry.json().id).toBe(sent.json().id)
    expect((await unread()).json()).toEqual([])
  })

  it('同一请求去重并拒绝内容变化，撤销仅作用于自己的令牌', async () => {
    const alice = await setup()
    const bob = await setup('bob')
    const send = (payload = content) =>
      app.inject({
        method: 'POST',
        url: '/api/v1/push/messages',
        headers: alice.pushHeaders,
        payload,
      })
    const first = await send()
    expect((await send()).json()).toEqual(first.json())
    expect((await send({ ...content, content: 'changed' })).statusCode).toBe(409)
    expect(
      (
        await app.inject({
          method: 'DELETE',
          url: `/api/v1/push/tokens/${alice.created.id}`,
          headers: bob.headers,
        })
      ).statusCode,
    ).toBe(404)
    expect((await send()).statusCode).toBe(201)
    expect(
      (
        await app.inject({
          method: 'DELETE',
          url: `/api/v1/push/tokens/${alice.created.id}`,
          headers: alice.headers,
        })
      ).statusCode,
    ).toBe(204)
    expect((await send()).statusCode).toBe(401)
    expect(
      (await app.inject({ url: '/api/v1/push/messages', headers: alice.headers })).json(),
    ).toHaveLength(1)
  })

  it('校验消息长度、限制推送频率，成功使用后更新令牌时间', async () => {
    const alice = await setup()
    const send = (payload: { content: string }) =>
      app.inject({
        method: 'POST',
        url: '/api/v1/push/messages',
        headers: alice.pushHeaders,
        payload,
      })
    expect((await send({ content: '' })).statusCode).toBe(400)
    expect((await send({ content: 'x'.repeat(100001) })).statusCode).toBe(400)
    for (let index = 0; index < 60; index++)
      expect((await send({ content: String(index) })).statusCode).toBe(201)
    expect((await send({ content: 'rate limited' })).statusCode).toBe(429)
    const tokens = await app.inject({ url: '/api/v1/push/tokens', headers: alice.headers })
    expect(tokens.json()[0].lastUsedAt).toBeTypeOf('number')
  })

  it('官方 MCP 客户端通过真实 HTTP 完成握手、发现工具和幂等投递', async () => {
    const alice = await setup()
    const baseUrl = await app.listen({ host: '127.0.0.1', port: 0 })
    const client = new Client({ name: 'push-integration-test', version: '1.0.0' })
    const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/api/v1/mcp`), {
      requestInit: { headers: alice.pushHeaders },
    })
    try {
      await client.connect(transport)
      expect((await client.listTools()).tools.map((tool) => tool.name)).toEqual(['send_result'])
      const result = await client.callTool({ name: 'send_result', arguments: content })
      expect(result.isError).not.toBe(true)
      expect((await client.callTool({ name: 'send_result', arguments: content })).content).toEqual(
        result.content,
      )
      expect(
        (await app.inject({ url: '/api/v1/push/messages', headers: alice.headers })).json(),
      ).toHaveLength(1)
      const blocked = await app.inject({
        method: 'POST',
        url: '/api/v1/mcp',
        headers: { ...alice.pushHeaders, origin: 'https://untrusted.example' },
        payload: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
      })
      expect(blocked.statusCode).toBe(403)
    } finally {
      await client.close()
    }
  })
})

it('数据库仅保存令牌哈希，追加推送表保留会话且兼容旧版，重启后已读不会重现', () => {
  const directory = mkdtempSync(join(tmpdir(), 'blank-push-persistence-'))
  const path = join(directory, 'blank.sqlite')
  let db = new DatabaseSync(path)
  try {
    migrateDatabase(db, path)
    db.exec('DROP TABLE push_messages; DROP TABLE push_tokens; PRAGMA user_version = 4;')
    db.prepare('INSERT INTO users VALUES (?, ?, ?, ?)').run('alice', '101', 'alice', 100)
    db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(
      'old-session',
      'alice',
      Date.now() + 60000,
    )
    migrateDatabase(db, path)
    const push = new PushStore(db)
    const created = push.createToken('alice', 'Codex')
    const stored = db.prepare('SELECT token_hash FROM push_tokens').get()!
    expect(stored.token_hash).toBe(hashToken(created.token))
    expect(stored.token_hash).not.toBe(created.token)
    const owner = push.authenticate(hashToken(created.token))
    const message = push.send(owner, { title: 'title', content: 'body', requestId: randomUUID() })
    push.markRead('alice', [message.id])
    db.close()
    db = new DatabaseSync(path)
    migrateDatabase(db, path)
    const restarted = new PushStore(db)
    expect(restarted.authenticate(hashToken(created.token))).toEqual(owner)
    expect(restarted.unread('alice')).toEqual([])
    expect(db.prepare('SELECT token_hash FROM sessions').get()!.token_hash).toBe('old-session')
    expect(db.prepare('PRAGMA user_version').get()!.user_version).toBe(4)
  } finally {
    db.close()
    expect(dirname(resolve(directory))).toBe(resolve(tmpdir()))
    rmSync(directory, { recursive: true })
  }
})
