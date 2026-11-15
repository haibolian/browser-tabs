import { z } from 'zod'
import { isSiteIconUrl } from './site-metadata'
import { colorModes, type ResolvedTheme } from './theme'
import { iconAppearanceSchema, iconBackgroundSchema } from './icon-appearance'
import { iconSizePresets, widgetSizePresets } from './desktop-layout'
import { iconNames } from './icon-presets'

export const colors = [
  '#406956',
  '#6688b7',
  '#9b7db5',
  '#d18e72',
  '#c8a04d',
  '#d17e96',
  '#606b7a',
  '#46a6a0',
] as const

const websiteUrl = z
  .string()
  .url()
  .refine(
    (value) => ['http:', 'https:'].includes(new URL(value).protocol),
    '只支持 http 或 https 网站',
  )
export const shortcutSchema = z
  .object({
    id: z.string(),
    kind: z.literal('shortcut'),
    title: z.string().min(1),
    url: websiteUrl,
    icon: z.enum(iconNames),
    iconSource: z.enum(['site', 'preset', 'text', 'upload']).default('preset'),
    favicon: z.string().refine(isSiteIconUrl, '网站图标地址无效').nullable().default(null),
    iconText: z.string().default(''),
    iconBackground: iconBackgroundSchema.default('#ffffff'),
    uploadedIcon: z
      .string()
      .regex(/^data:image\/[a-zA-Z0-9.+-]+;base64,/)
      .nullable()
      .default(null),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  })
  .superRefine((shortcut, context) => {
    if (shortcut.iconSource === 'text' && !shortcut.iconText.trim())
      context.addIssue({ code: 'custom', path: ['iconText'], message: '文字图标缺少图标文字' })
    if (shortcut.iconSource === 'upload' && !shortcut.uploadedIcon)
      context.addIssue({ code: 'custom', path: ['uploadedIcon'], message: '上传图标缺少图片' })
  })
export const folderSchema = z.object({
  id: z.string(),
  kind: z.literal('folder'),
  title: z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  items: z.array(shortcutSchema),
})
export const workspaceSchema = z
  .object({
    version: z.literal(1),
    todos: z.array(
      z.object({ id: z.string(), text: z.string(), done: z.boolean(), createdAt: z.number() }),
    ),
    notes: z.array(
      z.object({ id: z.string(), title: z.string(), content: z.string(), updatedAt: z.number() }),
    ),
    items: z.array(z.discriminatedUnion('kind', [shortcutSchema, folderSchema])),
    desktopOrder: z.array(z.string()).default([]),
    desktopPositions: z
      .record(
        z.string(),
        z.object({ column: z.number().int().min(0), row: z.number().int().min(0) }),
      )
      .default({}),
    gridLayouts: z
      .record(
        z.string(),
        z.record(
          z.string().regex(/^[1-9]\d*x[1-9]\d*$/),
          z.record(
            z.string(),
            z.object({
              column: z.number().int().min(0),
              row: z.number().int().min(0),
            }),
          ),
        ),
      )
      .default({}),
    iconSizes: z.record(z.string(), z.enum(iconSizePresets.map((size) => size.id))).default({}),
    widgetSizes: z
      .object({
        todo: z.enum(widgetSizePresets.map((size) => size.id)),
        notes: z.enum(widgetSizePresets.map((size) => size.id)),
      })
      .default({ todo: '2x2', notes: '2x2' }),
    settings: z
      .object({
        theme: z.enum(colorModes).default('system'),
        wallpaper: z.enum([
          'morning',
          'dawn',
          'lavender',
          'ocean',
          'rose',
          'sage',
          'paper',
          'cloud',
          'sand',
          'blue',
          'uploaded',
        ]),
        imageId: z.string().nullable(),
        imageDim: z.number().min(0).max(60),
        wallpaperBlur: z.number().min(0).max(30).default(0),
        searchEngine: z.enum(['bing', 'google', 'baidu']),
        openInNewTab: z.boolean(),
        showSeconds: z.boolean(),
        showWidgets: z.boolean(),
        reducedMotion: z.boolean(),
        icons: iconAppearanceSchema.default(() => iconAppearanceSchema.parse({})),
      })
      .refine(
        (settings) => settings.wallpaper !== 'uploaded' || settings.imageId !== null,
        '图片壁纸缺少图片引用',
      ),
  })
  .superRefine((workspace, context) => {
    const ids = workspace.items.flatMap((item) =>
      item.kind === 'folder' ? [item.id, ...item.items.map((child) => child.id)] : [item.id],
    )
    if (new Set(ids).size !== ids.length)
      context.addIssue({ code: 'custom', message: '网站或分组的标识重复', path: ['items'] })
    for (const key of ['todos', 'notes'] as const) {
      if (new Set(workspace[key].map((item) => item.id)).size !== workspace[key].length)
        context.addIssue({
          code: 'custom',
          message: `${key === 'todos' ? '待办' : '备忘'}的标识重复`,
          path: [key],
        })
    }
  })

export type Workspace = z.infer<typeof workspaceSchema>
export type Shortcut = z.infer<typeof shortcutSchema>
export type Folder = z.infer<typeof folderSchema>
export type DesktopItem = Shortcut | Folder
export type Todo = Workspace['todos'][number]
export type Note = Workspace['notes'][number]
export type Settings = Workspace['settings']
export type UpdateWorkspace = (updater: (workspace: Workspace) => Workspace) => void

export function createId() {
  return crypto.randomUUID()
}

export function createWorkspace(): Workspace {
  const now = Date.now()
  const site = (
    id: string,
    title: string,
    url: string,
    icon: Shortcut['icon'],
    color: string,
  ): Shortcut => ({
    id,
    kind: 'shortcut',
    title,
    url,
    icon,
    color,
    iconSource: 'preset',
    favicon: null,
    iconText: '',
    iconBackground: 'transparent',
    uploadedIcon: null,
  })
  return {
    version: 1,
    desktopOrder: [],
    desktopPositions: {},
    gridLayouts: {},
    iconSizes: {},
    widgetSizes: { todo: '2x2', notes: '2x2' },
    todos: [
      { id: createId(), text: '写下今天的目标', done: false, createdAt: now },
      { id: createId(), text: '整理常用网站', done: false, createdAt: now },
    ],
    notes: [
      {
        id: createId(),
        title: '欢迎来到留白',
        content:
          '从一个轻盈的新标签页开始。\n\n待办可以直接在桌面输入，点文字就能修改，按 Enter 添加下一项。\n\n点击备忘录，在这里慢慢写下想法。你也可以拖动网站排序，把它们收进分组，再选一个喜欢的背景。\n\n这是一条示例备忘，可以自由编辑或删除。内容自动保存在当前浏览器；使用 GitHub 登录后，修改会自动上传，其他设备可在设置中手动拉取备份。',
        updatedAt: now,
      },
      {
        id: createId(),
        title: '留住一闪而过的灵感',
        content:
          '不必急着整理，先把想法记下来。\n\n这是一条示例备忘。点击右上角 +，开始自己的第一篇记录吧。',
        updatedAt: now,
      },
    ],
    items: [
      site('github', 'GitHub', 'https://github.com', 'github', '#34383c'),
      site('figma', 'Figma', 'https://www.figma.com', 'figma', '#8a71b4'),
      site('notion', 'Notion', 'https://www.notion.so', 'notion', '#575b55'),
      site('bilibili', '哔哩哔哩', 'https://www.bilibili.com', 'video', '#e28ba1'),
      site('chatgpt', 'ChatGPT', 'https://chatgpt.com', 'sparkles', '#589a80'),
      {
        id: 'tools',
        kind: 'folder',
        title: '开发工具',
        color: '#82976d',
        items: [
          site('mdn', 'MDN', 'https://developer.mozilla.org/zh-CN/', 'book', '#6688b7'),
          site('react', 'React', 'https://react.dev', 'code', '#46a6a0'),
          site('shadcn', 'shadcn/ui', 'https://ui.shadcn.com', 'design', '#606b7a'),
          site('vite', 'Vite', 'https://vite.dev', 'sparkles', '#9b7db5'),
        ],
      },
    ],
    settings: {
      theme: 'system',
      wallpaper: 'morning',
      imageId: null,
      imageDim: 10,
      wallpaperBlur: 0,
      searchEngine: 'bing',
      openInNewTab: true,
      showSeconds: false,
      showWidgets: true,
      reducedMotion: false,
      icons: iconAppearanceSchema.parse({}),
    },
  }
}

export function normalizeUrl(input: string): string {
  const value = input.trim()
  if (!value) throw new Error('请输入网站地址')
  const url = new URL(/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value) ? value : `https://${value}`)
  if (url.protocol !== 'https:' && url.protocol !== 'http:')
    throw new Error('只支持 http 或 https 网站')
  if (!url.hostname.includes('.') && url.hostname !== 'localhost')
    throw new Error('请输入有效的网站地址，例如 example.com')
  return url.href
}

export function findShortcut(items: DesktopItem[], id: string): Shortcut | undefined {
  for (const item of items) {
    if (item.kind === 'shortcut' && item.id === id) return item
    if (item.kind === 'folder') {
      const found = item.items.find((child) => child.id === id)
      if (found) return found
    }
  }
}

export function removeShortcut(items: DesktopItem[], id: string): DesktopItem[] {
  return items
    .filter((item) => item.id !== id)
    .map((item) =>
      item.kind === 'folder'
        ? { ...item, items: item.items.filter((child) => child.id !== id) }
        : item,
    )
}

export function upsertShortcut(
  items: DesktopItem[],
  shortcut: Shortcut,
  parentId: string | null,
): DesktopItem[] {
  if (parentId && !items.some((item) => item.kind === 'folder' && item.id === parentId))
    throw new Error('目标分组不存在')
  const previous = findShortcut(items, shortcut.id)
  const previousParent = items.find(
    (item) => item.kind === 'folder' && item.items.some((child) => child.id === shortcut.id),
  )
  if (previous && (previousParent?.id ?? null) === parentId)
    return items.map((item) =>
      item.id === shortcut.id
        ? shortcut
        : item.kind === 'folder'
          ? {
              ...item,
              items: item.items.map((child) => (child.id === shortcut.id ? shortcut : child)),
            }
          : item,
    )
  const remaining = removeShortcut(items, shortcut.id)
  return parentId
    ? remaining.map((item) =>
        item.id === parentId && item.kind === 'folder'
          ? { ...item, items: [...item.items, shortcut] }
          : item,
      )
    : [...remaining, shortcut]
}

export function moveShortcut(
  items: DesktopItem[],
  id: string,
  targetFolderId: string | null,
): DesktopItem[] {
  const shortcut = findShortcut(items, id)
  if (!shortcut) throw new Error('找不到要移动的网站')
  if (targetFolderId && !items.some((item) => item.id === targetFolderId && item.kind === 'folder'))
    throw new Error('目标分组不存在')
  const next = removeShortcut(items, id)
  return targetFolderId
    ? next.map((item) =>
        item.id === targetFolderId && item.kind === 'folder'
          ? { ...item, items: [...item.items, shortcut] }
          : item,
      )
    : [...next, shortcut]
}

export function ungroupFolder(items: DesktopItem[], folderId: string): DesktopItem[] {
  return items.flatMap((item) =>
    item.id === folderId && item.kind === 'folder' ? item.items : [item],
  )
}

export function getDesktopOrder(saved: string[], available: string[]): string[] {
  const valid = new Set(available)
  const ordered = [...new Set(saved)].filter((id) => valid.has(id))
  return [...ordered, ...available.filter((id) => !ordered.includes(id))]
}

export const searchEngines = {
  bing: { label: '必应', letter: 'b', url: 'https://www.bing.com/search?q=' },
  google: { label: 'Google', letter: 'G', url: 'https://www.google.com/search?q=' },
  baidu: { label: '百度', letter: '百', url: 'https://www.baidu.com/s?wd=' },
}

export const wallpapers = [
  {
    id: 'morning',
    name: '纯净',
    type: 'solid',
    value: '#ffffff',
    darkValue: '#000000',
  },
  {
    id: 'dawn',
    name: '杏色微光',
    darkValue:
      'radial-gradient(ellipse at 80% 5%, #443322 0%, transparent 60%), linear-gradient(140deg, #231e19, #2d241e 65%, #28281d)',
    type: 'gradient',
    value:
      'radial-gradient(ellipse at 80% 5%, #f4dcbf 0%, transparent 60%), linear-gradient(140deg, #f3ece5, #ede3dc 65%, #e9e4db)',
  },
  {
    id: 'lavender',
    name: '紫雾',
    darkValue:
      'radial-gradient(ellipse at 12% 12%, #352940 0%, transparent 60%), linear-gradient(145deg, #221e2c, #1b2732)',
    type: 'gradient',
    value:
      'radial-gradient(ellipse at 12% 12%, #e6dcf0 0%, transparent 60%), linear-gradient(145deg, #efedf4, #dde4ed)',
  },
  {
    id: 'ocean',
    name: '浅海',
    darkValue:
      'radial-gradient(ellipse at 90% 0%, #1e3b3c 0%, transparent 55%), linear-gradient(130deg, #152429, #1b2937)',
    type: 'gradient',
    value:
      'radial-gradient(ellipse at 90% 0%, #d2e6e7 0%, transparent 55%), linear-gradient(130deg, #eaf1f2, #d9e4eb)',
  },
  {
    id: 'rose',
    name: '落日来信',
    darkValue:
      'radial-gradient(ellipse at 100% 100%, #4a302b 0%, transparent 70%), linear-gradient(145deg, #2b1e28, #302229)',
    type: 'gradient',
    value:
      'radial-gradient(ellipse at 100% 100%, #eecbbd 0%, transparent 70%), linear-gradient(145deg, #f1e7e9, #ece3e6)',
  },
  { id: 'sage', name: '鼠尾草', type: 'solid', value: '#e3e9de', darkValue: '#202c22' },
  { id: 'paper', name: '暖纸', type: 'solid', value: '#eeebe4', darkValue: '#27271f' },
  { id: 'cloud', name: '云白', type: 'solid', value: '#edf0f3', darkValue: '#232b32' },
  { id: 'sand', name: '沙丘', type: 'solid', value: '#e8dfd2', darkValue: '#30271d' },
  { id: 'blue', name: '雾蓝', type: 'solid', value: '#dce5eb', darkValue: '#1e2b37' },
] as const

export function getWallpaperValue(wallpaper: (typeof wallpapers)[number], theme: ResolvedTheme) {
  return theme === 'dark' ? wallpaper.darkValue : wallpaper.value
}
