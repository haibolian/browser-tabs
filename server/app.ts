import Fastify, { type FastifyRequest } from 'fastify'
import cors from '@fastify/cors'
import { z, ZodError } from 'zod'
import { backupSchema } from '../src/lib/backup'
import {
  backupUploadSchema,
  githubCompleteSchema,
  githubStartSchema,
} from '../src/lib/cloud-contract'
import { codeChallenge, createSecret, createSession, hashToken } from './auth'
import { GitHubOAuth, type GitHubConfig } from './github'
import { Store } from './database'
import { ApiError } from './errors'
import type { BackupPolicy } from './backups'

export function createApp(options: {
  databasePath: string
  sessionDays?: number
  logger?: boolean
  github?: GitHubConfig
  backupPolicy?: BackupPolicy
}) {
  const store = new Store(options.databasePath, options.backupPolicy)
  // Request bodies contain original images; BackupStore enforces snapshot retention.
  const app = Fastify({
    logger: options.logger
      ? {
          serializers: {
            req: (request) => ({ method: request.method, url: request.url.split('?')[0] }),
          },
        }
      : false,
    bodyLimit: Number.MAX_SAFE_INTEGER,
  })
  const sessionDays = options.sessionDays ?? 30
  const github = options.github ? new GitHubOAuth(options.github) : undefined
  function requireGitHub() {
    if (!github || !options.github)
      throw new ApiError(
        503,
        '服务器尚未配置 GitHub 登录，请先设置 GITHUB_CLIENT_ID 和 GITHUB_CLIENT_SECRET',
      )
    return { provider: github, config: options.github }
  }
  app.addHook('onClose', async () => store.close())
  app.register(cors, { origin: '*', methods: ['GET', 'POST', 'DELETE'] })
  app.addHook('onSend', async (_request, reply) => {
    reply.header('Cache-Control', 'no-store')
    reply.header('X-Content-Type-Options', 'nosniff')
    reply.header('Referrer-Policy', 'no-referrer')
  })
  app.setErrorHandler((error: Error & { statusCode?: number }, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({ error: error.issues.map((issue) => issue.message).join('；') })
    }
    if (error instanceof ApiError)
      return reply.code(error.statusCode).send({ error: error.message })
    if (error.statusCode && error.statusCode < 500) {
      return reply.code(error.statusCode).send({ error: error.message })
    }
    request.log.error(error)
    return reply.code(500).send({ error: '服务器处理失败，请检查服务日志' })
  })

  function requestTokenHash(request: FastifyRequest) {
    const match = /^Bearer (\S+)$/.exec(request.headers.authorization ?? '')
    if (!match) throw new ApiError(401, '请先登录')
    return hashToken(match[1])
  }

  function authenticate(request: FastifyRequest) {
    const tokenHash = requestTokenHash(request)
    const user = store.sessionUser(tokenHash)
    if (!user) throw new ApiError(401, '登录已失效，请重新登录')
    return { user, tokenHash }
  }

  app.get('/api/v1/health', async () => ({ status: 'ok' }))
  app.post('/api/v1/auth/github/start', async (request) => {
    const { provider, config } = requireGitHub()
    const input = githubStartSchema.parse(request.body)
    if (!config.returnUrls.includes(input.returnUrl))
      throw new ApiError(
        400,
        '当前页面未配置为 GitHub 登录返回地址，请在服务器的 GITHUB_RETURN_URLS 中添加该地址',
      )
    const state = createSecret()
    store.createOAuthRequest(hashToken(state), input.returnUrl, input.codeChallenge)
    return { state, authorizationUrl: provider.authorizationUrl(state, input.codeChallenge) }
  })
  app.get('/api/v1/auth/github/callback', async (request, reply) => {
    requireGitHub()
    const input = z
      .object({
        state: z.string().min(1),
        code: z.string().optional(),
        error: z.string().optional(),
      })
      .refine(
        (value) => Boolean(value.code) !== Boolean(value.error),
        'GitHub 回调缺少有效授权结果',
      )
      .parse(request.query)
    const flow = store.oauthRequest(hashToken(input.state))
    const url = new URL(flow.returnUrl)
    url.hash = new URLSearchParams({
      github_state: input.state,
      ...(input.error ? { github_error: input.error } : { github_code: input.code! }),
    }).toString()
    return reply.redirect(url.href)
  })
  app.post('/api/v1/auth/github/complete', async (request) => {
    const { provider } = requireGitHub()
    const input = githubCompleteSchema.parse(request.body)
    store.consumeOAuthRequest(hashToken(input.state), codeChallenge(input.codeVerifier))
    const identity = await provider.identify(input.code, input.codeVerifier)
    const session = createSession(sessionDays)
    const user = store.signIn(identity, session.tokenHash, session.expiresAt)
    return {
      user,
      token: session.token,
      expiresAt: session.expiresAt,
    }
  })
  app.get('/api/v1/auth/me', async (request) => authenticate(request).user)
  app.post('/api/v1/auth/logout', async (request, reply) => {
    store.logout(requestTokenHash(request))
    return reply.code(204).send()
  })
  app.get('/api/v1/backups', async (request) => store.listBackups(authenticate(request).user.id))
  app.post('/api/v1/backups', async (request, reply) => {
    const { user } = authenticate(request)
    const backup = backupSchema.parse(request.body)
    const uploadKey = z.string().uuid().optional().parse(request.headers['idempotency-key'])
    const upload = backupUploadSchema.parse({
      mode: request.headers['x-backup-mode'],
      deviceId: request.headers['x-backup-device'],
    })
    return reply.code(201).send(store.saveBackup(user.id, backup, uploadKey, upload))
  })
  app.get('/api/v1/backups/:id', async (request) => {
    const { user } = authenticate(request)
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    const backup = backupSchema.safeParse(store.readBackup(user.id, id))
    if (!backup.success) throw new Error('数据库中的备份结构无效', { cause: backup.error })
    return backup.data
  })
  app.delete('/api/v1/backups/:id', async (request, reply) => {
    const { user } = authenticate(request)
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    store.deleteBackup(user.id, id)
    return reply.code(204).send()
  })
  return app
}
