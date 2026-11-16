import { prepareImage } from './image-processing'
import { z } from 'zod'
import type { CSSProperties } from 'react'

export const iconColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/)
export const iconBackgroundSchema = z.union([
  z.string().regex(/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/),
  z.literal('transparent'),
])
export const iconAppearanceSchema = z.object({
  shape: z.enum(['rounded', 'circle']).default('rounded'),
  size: z.number().min(50).max(100).default(60),
  radius: z.number().min(0).max(30).default(18),
  opacity: z.number().min(0.2).max(1).default(1),
  gapX: z.number().min(0).max(100).default(30),
  gapY: z.number().min(0).max(100).default(30),
  syncGap: z.boolean().default(true),
  showName: z.boolean().default(true),
  nameSize: z.number().min(12).max(20).default(12),
  nameColor: iconColorSchema.nullable().default(null),
  maxWidth: z.number().min(900).max(2000).default(1350),
})

export type IconAppearance = z.infer<typeof iconAppearanceSchema>

export const iconColors = [
  '#1681ff',
  '#fbbe23',
  '#fc4548',
  '#4b3c36',
  '#7dac68',
  '#023373',
  '#c8ac70',
  '#372128',
  '#c82c34',
  '#054092',
  '#a3ddb9',
  '#000000',
  '#ffffff',
] as const

export function iconAppearanceStyle(settings: IconAppearance): CSSProperties {
  return {
    '--site-icon-size': `${settings.size}px`,
    '--site-icon-radius': settings.shape === 'circle' ? '50%' : `${settings.radius}px`,
    '--site-mini-radius':
      settings.shape === 'circle' ? '50%' : `${(settings.radius / settings.size) * 100}%`,
    '--site-icon-opacity': settings.opacity,
    '--site-gap-x': `${settings.gapX}px`,
    '--site-gap-y': `${settings.gapY}px`,
    '--site-name-size': `${settings.nameSize}px`,
    '--site-name-display': settings.showName ? 'block' : 'none',
    '--site-name-color': settings.nameColor ?? 'var(--desktop-foreground)',
  } as CSSProperties
}

export function folderAppearanceStyle(settings: IconAppearance): CSSProperties {
  return {
    ...iconAppearanceStyle(settings),
    '--site-name-color': 'var(--foreground)',
  } as CSSProperties
}

export function initialIconText(title: string) {
  return Array.from(title.trim()).slice(0, 3).join('')
}

export async function readIconImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('请选择图片文件')
  const { blob } = await prepareImage(file, 256, 256)
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('读取图标图片失败，请重新选择文件'))
    reader.readAsDataURL(blob)
  })
  return data
}
