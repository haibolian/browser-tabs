import { resolve } from 'node:path'
import { z } from 'zod'
import { createApp } from './app'
import { defaultBackupPolicy } from './backups'

const config = z
  .object({
    HOST: z.string().default('127.0.0.1'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    DATABASE_PATH: z.string().min(1).default('server/data/blank.sqlite'),
    SESSION_DAYS: z.coerce.number().positive().default(30),
    BACKUP_LIMIT: z.coerce.number().int().positive().default(defaultBackupPolicy.limit),
    AUTO_BACKUP_MERGE_MINUTES: z.coerce.number().min(0).default(defaultBackupPolicy.mergeMinutes),
    GITHUB_CLIENT_ID: z.string().default(''),
    GITHUB_CLIENT_SECRET: z.string().default(''),
    GITHUB_CALLBACK_URL: z
      .string()
      .url()
      .default('http://127.0.0.1:3001/api/v1/auth/github/callback'),
    GITHUB_RETURN_URLS: z.string().default('http://127.0.0.1:9900/'),
  })
  .refine(
    (value) => Boolean(value.GITHUB_CLIENT_ID) === Boolean(value.GITHUB_CLIENT_SECRET),
    'GITHUB_CLIENT_ID 和 GITHUB_CLIENT_SECRET 必须同时配置',
  )
  .parse(process.env)

const returnUrls = z
  .array(
    z
      .string()
      .url()
      .refine((value) => {
        const url = new URL(value)
        return (
          ['http:', 'https:'].includes(url.protocol) &&
          !url.username &&
          !url.password &&
          !url.search &&
          !url.hash
        )
      }, 'GitHub 返回地址必须是无查询参数和片段的完整 http/https 地址'),
  )
  .min(1)
  .parse(config.GITHUB_RETURN_URLS.split(',').map((url) => url.trim()))

const app = createApp({
  databasePath: resolve(config.DATABASE_PATH),
  sessionDays: config.SESSION_DAYS,
  logger: true,
  backupPolicy: { limit: config.BACKUP_LIMIT, mergeMinutes: config.AUTO_BACKUP_MERGE_MINUTES },
  github: config.GITHUB_CLIENT_ID
    ? {
        clientId: config.GITHUB_CLIENT_ID,
        clientSecret: config.GITHUB_CLIENT_SECRET,
        callbackUrl: config.GITHUB_CALLBACK_URL,
        returnUrls,
      }
    : undefined,
})

if (!config.GITHUB_CLIENT_ID)
  app.log.warn(
    'GitHub OAuth 尚未配置。服务可以启动，但登录会明确返回 503；请配置 .env.server 后重启。',
  )

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    app.close().catch((error: unknown) => {
      app.log.error(error)
      process.exitCode = 1
    })
  })
}

try {
  await app.listen({ host: config.HOST, port: config.PORT })
} catch (error) {
  app.log.error(error)
  await app.close()
  process.exitCode = 1
}
