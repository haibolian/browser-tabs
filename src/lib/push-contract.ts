import { z } from 'zod'

export const pushTokenInputSchema = z.object({
  name: z.string().trim().min(1).max(80).default('Codex'),
})
export const pushTokenSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  suffix: z.string(),
  createdAt: z.number(),
  lastUsedAt: z.number().nullable(),
})
export const createdPushTokenSchema = pushTokenSchema.extend({ token: z.string() })
export const pushMessageInputSchema = z.object({
  title: z.string().trim().max(200).default(''),
  content: z.string().min(1).max(100_000),
  requestId: z.string().trim().min(1).max(128).optional(),
})
export const pushMessageSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  content: z.string(),
  createdAt: z.number(),
  readAt: z.number().nullable(),
})
export const readPushMessagesSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(200) })
export type PushToken = z.infer<typeof pushTokenSchema>
export type CreatedPushToken = z.infer<typeof createdPushTokenSchema>
export type PushMessage = z.infer<typeof pushMessageSchema>
export type PushMessageInput = z.infer<typeof pushMessageInputSchema>
