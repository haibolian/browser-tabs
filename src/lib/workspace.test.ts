import { describe, expect, it } from 'vitest'
import {
  createWorkspace,
  findShortcut,
  getDesktopOrder,
  moveShortcut,
  normalizeUrl,
  removeShortcut,
  ungroupFolder,
  workspaceSchema,
  shortcutSchema,
  upsertShortcut,
  type Folder,
} from './workspace'

describe('网站与分组', () => {
  it('混合网格保留组件与网站的排序，去除失效图标并补上新图标', () => {
    expect(
      getDesktopOrder(
        ['github', 'widget:todo', 'deleted', 'github'],
        ['widget:todo', 'widget:notes', 'github', 'figma'],
      ),
    ).toEqual(['github', 'widget:todo', 'widget:notes', 'figma'])
  })
  it('把桌面网站移入分组，保留原网站和其他网站', () => {
    const state = createWorkspace()
    const github = findShortcut(state.items, 'github')
    const result = moveShortcut(state.items, 'github', 'tools')
    expect(result.some((item) => item.id === 'github')).toBe(false)
    expect((result.find((item) => item.id === 'tools') as Folder).items.at(-1)).toEqual(github)
    expect(state.items.some((item) => item.id === 'github')).toBe(true)
    expect(result.flatMap((item) => (item.kind === 'folder' ? item.items : [item]))).toHaveLength(9)
  })
  it('将分组里的网站移回桌面，不产生副本', () => {
    const result = moveShortcut(createWorkspace().items, 'react', null)
    expect(result.at(-1)?.id).toBe('react')
    expect(
      (result.find((item) => item.id === 'tools') as Folder).items.some(
        (item) => item.id === 'react',
      ),
    ).toBe(false)
  })
  it('拒绝不存在的目标分组，避免网站丢失', () => {
    expect(() => moveShortcut(createWorkspace().items, 'github', 'missing')).toThrow(
      '目标分组不存在',
    )
    expect(() => moveShortcut(createWorkspace().items, 'missing', null)).toThrow(
      '找不到要移动的网站',
    )
  })
  it('解散分组时保留所有网站及原有位置', () => {
    const result = ungroupFolder(createWorkspace().items, 'tools')
    expect(result.every((item) => item.kind === 'shortcut')).toBe(true)
    expect(result).toHaveLength(9)
    expect(result.slice(-4).map((item) => item.id)).toEqual(['mdn', 'react', 'shadcn', 'vite'])
  })
  it('删除组内网站时保留分组和其他网站', () => {
    const result = removeShortcut(createWorkspace().items, 'mdn')
    expect((result.find((item) => item.id === 'tools') as Folder).items).toHaveLength(3)
    expect(findShortcut(result, 'mdn')).toBeUndefined()
  })
})

describe('图片与文字图标', () => {
  it('读取旧存档时补齐图标设置，并保留原有系统预设和网站图片', () => {
    const state = createWorkspace()
    const settings = Object.fromEntries(
      Object.entries(state.settings).filter(([key]) => key !== 'icons'),
    )
    const oldSite = Object.fromEntries(
      Object.entries(findShortcut(state.items, 'github')!).filter(
        ([key]) => !['iconText', 'uploadedIcon', 'iconBackground'].includes(key),
      ),
    )
    const loaded = workspaceSchema.parse({
      ...state,
      settings,
      iconSizes: undefined,
      items: [{ ...oldSite, iconSource: 'site', favicon: 'https://example.com/icon.png' }],
    })
    expect(loaded.settings.icons).toMatchObject({
      size: 60,
      radius: 18,
      shape: 'rounded',
      showName: true,
    })
    expect(loaded.iconSizes).toEqual({})
    expect(loaded.items[0]).toMatchObject({
      ...oldSite,
      iconSource: 'site',
      favicon: 'https://example.com/icon.png',
      iconBackground: '#ffffff',
      uploadedIcon: null,
    })
    expect(loaded.todos).toEqual(state.todos)
  })
  it('文字、独立网站名称、透明底色和尺寸在备份中完整保留', () => {
    const state = createWorkspace()
    const site = {
      ...findShortcut(state.items, 'github')!,
      iconSource: 'text' as const,
      iconText: '我的工作',
      iconBackground: 'transparent',
    }
    const saved = { ...state, items: [site], iconSizes: { github: '2x1' } }
    const restored = workspaceSchema.parse(JSON.parse(JSON.stringify(saved)))
    expect(restored.items[0]).toMatchObject({
      title: 'GitHub',
      iconText: '我的工作',
      iconSource: 'text',
      iconBackground: 'transparent',
    })
    expect(restored.iconSizes.github).toBe('2x1')
  })
  it('上传图片随网站和分组移动，编辑时保留其所在位置', () => {
    const items = createWorkspace().items
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60"><rect width="60" height="60" fill="red"/></svg>',
    ).toString('base64')
    const shortcut = {
      ...findShortcut(items, 'github')!,
      iconSource: 'upload' as const,
      uploadedIcon: `data:image/svg+xml;base64,${svg}`,
    }
    const moved = upsertShortcut(items, shortcut, 'tools')
    const updated = upsertShortcut(moved, { ...shortcut, title: '代码' }, 'tools')
    expect((updated.find((entry) => entry.id === 'tools') as Folder).items.at(-1)).toEqual({
      ...shortcut,
      title: '代码',
    })
    const restored = workspaceSchema.parse(
      JSON.parse(JSON.stringify({ ...createWorkspace(), items: updated })),
    )
    expect(findShortcut(restored.items, 'github')?.uploadedIcon).toBe(shortcut.uploadedIcon)
    expect(updated.filter((entry) => entry.id === 'github')).toHaveLength(0)
  })
  it('原位编辑图标保留桌面顺序，不把网站移到末尾', () => {
    const items = createWorkspace().items
    const changed = {
      ...findShortcut(items, 'figma')!,
      iconSource: 'text' as const,
      iconText: '设计',
      iconBackground: '#1681ff',
    }
    const updated = upsertShortcut(items, changed, null)
    expect(updated.map((item) => item.id)).toEqual(items.map((item) => item.id))
    expect(updated[1]).toEqual(changed)
  })
  it('拒绝没有内容的文字图标、缺失的上传图片和非图片内容', () => {
    const site = findShortcut(createWorkspace().items, 'github')!
    expect(shortcutSchema.safeParse({ ...site, iconSource: 'text', iconText: '  ' }).success).toBe(
      false,
    )
    expect(
      shortcutSchema.safeParse({ ...site, iconSource: 'upload', uploadedIcon: null }).success,
    ).toBe(false)
    expect(
      shortcutSchema.safeParse({
        ...site,
        iconSource: 'upload',
        uploadedIcon: 'data:text/html;base64,SGk=',
      }).success,
    ).toBe(false)
  })
})

describe('地址和备份校验', () => {
  it('补全 https，并保留 http、端口和路径', () => {
    expect(normalizeUrl(' example.com/notes?q=1 ')).toBe('https://example.com/notes?q=1')
    expect(normalizeUrl('http://localhost:5173/')).toBe('http://localhost:5173/')
  })
  it.each(['javascript:alert(1)', 'data:text/html,test', 'file:///C:/test', 'ftp://example.com'])(
    '拒绝可执行或非网站地址 %s',
    (url) => {
      expect(() => normalizeUrl(url)).toThrow('只支持 http 或 https 网站')
    },
  )
  it('拒绝空地址与不完整域名', () => {
    expect(() => normalizeUrl('')).toThrow()
    expect(() => normalizeUrl('invalid')).toThrow('请输入有效的网站地址')
  })
  it('初始工作区完整通过备份校验', () => {
    expect(workspaceSchema.parse(createWorkspace()).version).toBe(1)
  })
  it('旧存档补上系统主题，并保留原有内容', () => {
    const state = createWorkspace()
    const oldSettings = Object.fromEntries(
      Object.entries(state.settings).filter(([key]) => key !== 'theme'),
    )
    const loaded = workspaceSchema.parse({ ...state, settings: oldSettings })
    expect(loaded.settings.theme).toBe('system')
    expect(loaded.todos).toEqual(state.todos)
    expect(loaded.notes).toEqual(state.notes)
    expect(loaded.items).toEqual(state.items)
  })
  it('主题偏好可以随存档保存，非法模式不能导入', () => {
    const state = createWorkspace()
    const dark = { ...state, settings: { ...state.settings, theme: 'dark' } }
    expect(workspaceSchema.parse(JSON.parse(JSON.stringify(dark))).settings.theme).toBe('dark')
    expect(
      workspaceSchema.safeParse({ ...state, settings: { ...state.settings, theme: 'invalid' } })
        .success,
    ).toBe(false)
  })
  it('保留站点图标来源，并拒绝可执行的图标地址', () => {
    const state = createWorkspace()
    const first = state.items[0]
    expect(
      workspaceSchema.safeParse({
        ...state,
        items: [{ ...first, iconSource: 'site', favicon: 'https://example.com/icon.svg' }],
      }).success,
    ).toBe(true)
    expect(
      workspaceSchema.safeParse({
        ...state,
        items: [{ ...first, iconSource: 'site', favicon: 'javascript:alert(1)' }],
      }).success,
    ).toBe(false)
  })
  it('拒绝重复标识、非法壁纸和没有图片的图片壁纸', () => {
    const state = createWorkspace()
    expect(
      workspaceSchema.safeParse({ ...state, items: [...state.items, state.items[0]] }).success,
    ).toBe(false)
    expect(
      workspaceSchema.safeParse({ ...state, settings: { ...state.settings, wallpaper: 'unknown' } })
        .success,
    ).toBe(false)
    expect(
      workspaceSchema.safeParse({
        ...state,
        settings: { ...state.settings, wallpaper: 'uploaded', imageId: null },
      }).success,
    ).toBe(false)
  })
})
