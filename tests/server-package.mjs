// Exercise the packaged backend with independently installed production dependencies.
import assert from 'node:assert/strict'
import { execFileSync, execSync, spawn } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const root = resolve(import.meta.dirname, '..')
const directory = await mkdtemp(join(tmpdir(), 'blank-server-release-'))
const database = join(directory, 'data', 'blank.sqlite')
const returnUrl = 'https://nplbljhenhbjjccehgckeanlbiknanoe.chromiumapp.org/github'
let child
let exited
let logs = ''

async function start() {
  const reservation = createServer()
  await new Promise((resolve, reject) => {
    reservation.once('error', reject)
    reservation.listen(0, '127.0.0.1', resolve)
  })
  const { port } = reservation.address()
  await new Promise((resolve, reject) =>
    reservation.close((error) => (error ? reject(error) : resolve())),
  )
  const baseUrl = `http://127.0.0.1:${port}`
  child = spawn(process.execPath, ['server-dist/index.mjs'], {
    cwd: directory,
    windowsHide: true,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      NODE_PATH: '',
      NODE_OPTIONS: '',
      HOST: '127.0.0.1',
      PORT: String(port),
      DATABASE_PATH: database,
      GITHUB_CLIENT_ID: 'bundle-test-client',
      GITHUB_CLIENT_SECRET: 'bundle-test-secret',
      GITHUB_CALLBACK_URL: `${baseUrl}/api/v1/auth/github/callback`,
      GITHUB_RETURN_URLS: returnUrl,
      BACKUP_LIMIT: '20',
      AUTO_BACKUP_MERGE_MINUTES: '10',
      SESSION_DAYS: '30',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const running = child
  exited = new Promise((resolve) => running.once('close', resolve))
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => finish(new Error('Server startup timed out')), 15_000)
    function finish(error) {
      clearTimeout(timeout)
      running.off('error', onError)
      running.off('exit', onExit)
      running.stdout.off('data', onOutput)
      if (error) reject(error)
      else resolve()
    }
    const onError = (error) => finish(error)
    const onExit = (code) => finish(new Error(`Server exited during startup: ${code}`))
    const onOutput = (chunk) => {
      if (chunk.toString().includes('Server listening at')) finish()
    }
    running.once('error', onError)
    running.once('exit', onExit)
    running.stdout.on('data', (chunk) => {
      logs += chunk
    })
    running.stderr.on('data', (chunk) => {
      logs += chunk
    })
    running.stdout.on('data', onOutput)
  })
  return baseUrl
}

async function stop() {
  if (!child) return
  if (child.exitCode === null && child.signalCode === null) child.kill()
  await exited
  child = undefined
}

try {
  execFileSync('tar', ['-xzf', join(root, 'browser-tabs-server.tar.gz'), '-C', directory], {
    windowsHide: true,
    stdio: 'inherit',
  })
  assert.deepEqual((await readdir(directory)).sort(), [
    'deploy',
    'docs',
    'package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    'server-dist',
  ])
  execSync('pnpm install --prod --frozen-lockfile', {
    cwd: directory,
    windowsHide: true,
    stdio: 'inherit',
    env: { ...process.env, CI: 'true' },
  })
  const dependencies = await readdir(join(directory, 'node_modules'))
  assert.ok(dependencies.includes('fastify'))
  assert.ok(!dependencies.includes('typescript'), 'Development dependencies must not be installed')
  let baseUrl = await start()
  const request = (path, options = {}) =>
    fetch(`${baseUrl}${path}`, {
      ...options,
      signal: AbortSignal.timeout(5_000),
    })
  const health = await request('/api/v1/health')
  assert.equal(health.status, 200)
  assert.deepEqual(await health.json(), { status: 'ok' })
  assert.equal((await request('/api/v1/backups')).status, 401)

  const preflight = await request('/api/v1/backups', {
    method: 'OPTIONS',
    headers: { Origin: 'https://example.com', 'Access-Control-Request-Method': 'POST' },
  })
  assert.equal(preflight.status, 204)
  assert.equal(preflight.headers.get('access-control-allow-origin'), '*')

  const challenge = createHash('sha256').update(randomBytes(32)).digest('base64url')
  const startLogin = (returnUrl) =>
    request('/api/v1/auth/github/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnUrl, codeChallenge: challenge }),
    })
  assert.equal((await startLogin('invalid-url')).status, 400)
  const authorization = await startLogin(returnUrl)
  assert.equal(authorization.status, 200)
  const { state, authorizationUrl } = await authorization.json()
  assert.equal(new URL(authorizationUrl).origin, 'https://github.com')
  assert.equal(new URL(authorizationUrl).searchParams.get('state'), state)

  const sessionToken = randomBytes(32).toString('base64url')
  const sessionHash = createHash('sha256').update(sessionToken).digest('hex')
  const seed = new DatabaseSync(database)
  try {
    seed
      .prepare('INSERT INTO users VALUES (?, ?, ?, ?)')
      .run('release-user', '101', 'release-test', Date.now())
    seed
      .prepare('INSERT INTO sessions VALUES (?, ?, ?)')
      .run(sessionHash, 'release-user', Date.now() + 60_000)
  } finally {
    seed.close()
  }
  const sessionHeaders = {
    Authorization: `Bearer ${sessionToken}`,
    'Content-Type': 'application/json',
  }
  const generated = await request('/api/v1/push/tokens', {
    method: 'POST',
    headers: sessionHeaders,
    body: JSON.stringify({ name: 'Release verification' }),
  })
  assert.equal(generated.status, 201)
  const pushToken = await generated.json()
  const pushHeaders = {
    Authorization: `Bearer ${pushToken.token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  }
  const rpc = async (id, method, params) =>
    request('/api/v1/mcp', {
      method: 'POST',
      headers: pushHeaders,
      body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
    })
  const initialized = await rpc(1, 'initialize', {
    protocolVersion: '2025-11-25',
    capabilities: {},
    clientInfo: { name: 'release-verifier', version: '1.0.0' },
  })
  assert.equal(initialized.status, 200)
  assert.equal((await initialized.json()).result.serverInfo.name, 'blank-push')
  const tools = await rpc(2, 'tools/list', {})
  assert.deepEqual(
    (await tools.json()).result.tools.map((tool) => tool.name),
    ['send_result'],
  )
  const toolArguments = {
    title: '部署验证',
    content: '验证完整消息和已读持久化。',
    requestId: 'release-verification',
  }
  const delivered = await rpc(3, 'tools/call', { name: 'send_result', arguments: toolArguments })
  assert.equal(delivered.status, 200)
  assert.notEqual((await delivered.json()).result.isError, true)
  const unread = await request('/api/v1/push/messages', { headers: sessionHeaders })
  const messages = await unread.json()
  assert.equal(messages.length, 1)
  assert.equal(messages[0].content, toolArguments.content)
  const read = await request('/api/v1/push/messages/read', {
    method: 'POST',
    headers: sessionHeaders,
    body: JSON.stringify({ ids: [messages[0].id] }),
  })
  assert.equal(read.status, 204)
  await rpc(4, 'tools/call', { name: 'send_result', arguments: toolArguments })
  assert.deepEqual(
    await (await request('/api/v1/push/messages', { headers: sessionHeaders })).json(),
    [],
  )
  assert.equal((await request('/api/v1/backups', { headers: pushHeaders })).status, 401)
  assert.equal(
    (
      await request(`/api/v1/push/tokens/${pushToken.id}`, {
        method: 'DELETE',
        headers: { Authorization: sessionHeaders.Authorization },
      })
    ).status,
    204,
  )
  assert.equal((await rpc(5, 'tools/list', {})).status, 401)

  await stop()
  const db = new DatabaseSync(database, { readOnly: true })
  try {
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM oauth_requests').get().count, 1)
  } finally {
    db.close()
  }

  baseUrl = await start()
  assert.deepEqual(
    await (await request('/api/v1/push/messages', { headers: sessionHeaders })).json(),
    [],
  )
  assert.deepEqual(
    await (await request('/api/v1/push/tokens', { headers: sessionHeaders })).json(),
    [],
  )
  const callback = await request(
    `/api/v1/auth/github/callback?state=${state}&error=access_denied`,
    {
      redirect: 'manual',
    },
  )
  assert.equal(callback.status, 302)
  const redirect = new URL(callback.headers.get('location'))
  assert.equal(`${redirect.origin}${redirect.pathname}`, returnUrl)
  assert.equal(new URLSearchParams(redirect.hash.slice(1)).get('github_error'), 'access_denied')
  console.log(
    'Verified release package with freshly installed production dependencies: startup, HTTP, CORS, validation, OAuth, MCP delivery, token revocation and read persistence across restarts.',
  )
} catch (error) {
  console.error(logs)
  throw error
} finally {
  await stop()
  assert.equal(dirname(directory), resolve(tmpdir()))
  assert.ok(basename(directory).startsWith('blank-server-release-'))
  await rm(directory, { recursive: true, force: true })
}
