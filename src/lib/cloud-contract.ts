import { z } from 'zod'

export const cloudUserSchema = z.object({
  id: z.string(),
  githubId: z.string().regex(/^\d+$/),
  login: z.string(),
})
export const githubStartSchema = z.object({
  returnUrl: z.string().url(),
  codeChallenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
})
export const githubAuthorizationSchema = z.object({
  authorizationUrl: z.string().url(),
  state: z.string(),
})
export const githubCompleteSchema = z.object({
  state: z.string().min(1),
  code: z.string().min(1),
  codeVerifier: z.string().regex(/^[A-Za-z0-9_-]{43,128}$/),
})
export const cloudSessionSchema = z.object({
  token: z.string(),
  expiresAt: z.number(),
  user: cloudUserSchema,
})
export const backupUploadSchema = z
  .object({
    mode: z.enum(['automatic', 'manual']).default('manual'),
    deviceId: z.string().uuid().optional(),
  })
  .refine(
    (value) => value.mode !== 'automatic' || value.deviceId !== undefined,
    '自动备份缺少设备标识',
  )
export type BackupUpload = z.infer<typeof backupUploadSchema>

export const cloudBackupSchema = z
  .object({
    id: z.string(),
    createdAt: z.number(),
    updatedAt: z.number().optional(),
    bytes: z.number(),
    todos: z.number(),
    notes: z.number(),
    sites: z.number(),
  })
  .transform((backup) => ({ ...backup, updatedAt: backup.updatedAt ?? backup.createdAt }))
export const cloudBackupListSchema = z.array(cloudBackupSchema)

export type GitHubIdentity = Pick<z.infer<typeof cloudUserSchema>, 'githubId' | 'login'>
export type CloudUser = z.infer<typeof cloudUserSchema>
export type CloudSession = z.infer<typeof cloudSessionSchema>
export type CloudBackup = z.infer<typeof cloudBackupSchema>
