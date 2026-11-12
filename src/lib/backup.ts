import { z } from 'zod'
import { workspaceSchema } from './workspace'

export const backupSchema = z
  .object({
    format: z.literal('blank-backup'),
    version: z.literal(1),
    workspace: workspaceSchema,
    image: z.string().nullable().default(null),
  })
  .superRefine((backup, context) => {
    if (
      backup.workspace.settings.imageId &&
      (!backup.image || !/^data:image\/(png|jpeg|webp|gif|avif);base64,/.test(backup.image))
    ) {
      context.addIssue({
        code: 'custom',
        path: ['image'],
        message: '备份中缺少有效的壁纸图片',
      })
    }
  })

export type Backup = z.infer<typeof backupSchema>
