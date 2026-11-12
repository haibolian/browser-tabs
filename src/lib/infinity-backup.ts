import { z } from 'zod'
import {
  createWorkspace,
  workspaceSchema,
  type DesktopItem,
  type Settings,
  type Shortcut,
  type Workspace,
} from './workspace'

const siteSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  type: z.enum(['web', 'app']),
  target: z.string(),
  bgType: z.enum(['image', 'color']),
  bgImage: z.string().optional(),
  bgColor: z.string().optional(),
  bgText: z.string().optional(),
})
const folderSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  children: z.array(siteSchema),
})
const backupSchema = z.object({
  version: z.literal('v2'),
  data: z.object({
    site: z.object({ sites: z.array(z.array(z.union([folderSchema, siteSchema]))) }),
    note: z
      .object({
        list: z.array(
          z.object({
            id: z.string().min(1),
            title: z.string(),
            content: z.string(),
            time: z.number(),
            updatetime: z.number().optional(),
          }),
        ),
      })
      .optional(),
    todo: z.object({ todoList: z.array(z.unknown()) }).optional(),
  }),
})

export type ImportedBackup = {
  workspace: Workspace
  source: 'blank' | 'infinity'
  notices: string[]
}

function backgroundColor(value: string | undefined) {
  if (!value || value === 'transparent') return 'transparent'
  if (/^#[\da-f]{6}([\da-f]{2})?$/i.test(value)) return value
  const rgba = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*(0|1|0?\.\d+))?\s*\)$/.exec(value)
  if (!rgba || rgba.slice(1, 4).some((part) => Number(part) > 255))
    throw new Error(`Infinity 图标背景色无效：${value}`)
  const alpha = rgba[4] === undefined ? 1 : Number(rgba[4])
  if (alpha === 0) return 'transparent'
  const rgb = rgba
    .slice(1, 4)
    .map((part) => Number(part).toString(16).padStart(2, '0'))
    .join('')
  return `#${rgb}${
    alpha === 1
      ? ''
      : Math.round(alpha * 255)
          .toString(16)
          .padStart(2, '0')
  }`
}

export function infinityNoteText(html: string) {
  const document = new DOMParser().parseFromString(html, 'text/html')
  document.querySelectorAll('script, style, template').forEach((node) => node.remove())
  document.querySelectorAll('br').forEach((node) => node.replaceWith('\n'))
  document
    .querySelectorAll('div, p, li, h1, h2, h3, h4, h5, h6, blockquote, pre, tr')
    .forEach((node) => node.append('\n'))
  return (document.body.textContent ?? '').replace(/\u00a0/g, ' ').replace(/\n+$/, '')
}

export function importInfinityBackup(
  raw: unknown,
  settings: Settings = createWorkspace().settings,
): ImportedBackup {
  const parsed = backupSchema.safeParse(raw)
  if (!parsed.success)
    throw new Error('Infinity 备份结构不正确，目前支持 v2 JSON 备份', { cause: parsed.error })
  const { data } = parsed.data
  if (data.todo?.todoList.length)
    throw new Error('这份 Infinity 备份包含尚不支持的待办格式，导入已取消，当前数据未更改')
  const skipped: string[] = []
  const unnamed: string[] = []
  function site(entry: z.infer<typeof siteSchema>): Shortcut | null {
    if (entry.type === 'app' || !/^https?:\/\//i.test(entry.target)) {
      skipped.push(entry.name)
      return null
    }
    if (entry.bgType === 'image' && !entry.bgImage)
      throw new Error(`Infinity 网站「${entry.name}」缺少图标图片`)
    const title = entry.name.trim() || new URL(entry.target).hostname
    if (!entry.name.trim()) unnamed.push(title)
    return {
      id: `infinity:${entry.id}`,
      kind: 'shortcut',
      title,
      url: entry.target,
      icon: 'globe',
      color: '#406956',
      iconSource: entry.bgType === 'color' ? 'text' : 'site',
      iconText: entry.bgType === 'color' ? (entry.bgText ?? '') : '',
      iconBackground: backgroundColor(entry.bgColor),
      favicon: entry.bgType === 'image' ? (entry.bgImage ?? null) : null,
      uploadedIcon: null,
    }
  }
  const items = data.site.sites.flat().flatMap<DesktopItem>((entry) => {
    if ('children' in entry)
      return [
        {
          id: `infinity:${entry.id}`,
          kind: 'folder' as const,
          title: entry.name,
          color: '#82976d',
          items: entry.children.flatMap((child) => {
            const converted = site(child)
            return converted ? [converted] : []
          }),
        },
      ]
    const converted = site(entry)
    return converted ? [converted] : []
  })
  const workspace = workspaceSchema.parse({
    version: 1,
    items,
    todos: [],
    notes: (data.note?.list ?? []).map((note) => ({
      id: `infinity:${note.id}`,
      title: note.title,
      content: infinityNoteText(note.content),
      updatedAt: note.updatetime ?? note.time,
    })),
    desktopOrder: items.map((item) => item.id),
    // Infinity icons occupy one cell, including folders.
    iconSizes: Object.fromEntries(items.map((item) => [item.id, '1x1'])),
    settings,
  })
  return {
    workspace,
    source: 'infinity',
    notices: [
      '随手记将转换为纯文本，保留文字和换行。',
      'Infinity 的壁纸、天气、搜索及界面设置不迁移，保留留白当前设置。',
      ...(unnamed.length
        ? [`${unnamed.length} 个网站未填写名称，将以域名显示：${unnamed.join('、')}。`]
        : []),
      ...(skipped.length
        ? [`已跳过 ${skipped.length} 个内置应用或非网页链接：${skipped.join('、')}。`]
        : []),
    ],
  }
}
