import { describe, expect, it } from 'vitest'
import { compactFolderLayout, dropShortcut, type GridDrop } from './shortcut-drag'
import { createWorkspace, findShortcut, workspaceSchema, type Folder } from './workspace'
import {
  arrangeDesktop,
  getIconSize,
  overlaps,
  positionsFromLayout,
  widgetSizePresets,
} from './desktop-layout'

const desktop: GridDrop = {
  kind: 'grid',
  folderId: null,
  layoutKey: '8x4',
  position: { column: 7, row: 3 },
  index: 31,
}
const folderDrop: GridDrop = {
  ...desktop,
  folderId: 'tools',
  position: { column: 1, row: 0 },
  index: 1,
}
const sites = (state: ReturnType<typeof createWorkspace>) =>
  state.items.flatMap((item) => (item.kind === 'folder' ? item.items : [item]))
const folder = (state: ReturnType<typeof createWorkspace>, id = 'tools') =>
  state.items.find((item) => item.id === id && item.kind === 'folder') as Folder

describe('分组拖拽', () => {
  it('桌面图标移入弹窗指定位置，原图标只保留一份', () => {
    const state = createWorkspace()
    const next = dropShortcut(state, 'github', folderDrop)
    expect(folder(next).items.map((item) => item.id)).toEqual([
      'mdn',
      'github',
      'react',
      'shadcn',
      'vite',
    ])
    expect(next.items.some((item) => item.id === 'github')).toBe(false)
    expect(sites(next)).toHaveLength(sites(state).length)
    expect(folder(state).items).toHaveLength(4)
  })

  it('组内排序会补位，拖至尾部仍在添加按钮之前', () => {
    const next = dropShortcut(createWorkspace(), 'mdn', {
      kind: 'order',
      folderId: 'tools',
      index: 99,
    })
    const ids = [...folder(next).items.map((item) => item.id), 'action:add']
    expect(ids).toEqual(['react', 'shadcn', 'vite', 'mdn', 'action:add'])
    expect(compactFolderLayout(ids, 3).map(({ id, column, row }) => ({ id, column, row }))).toEqual(
      [
        { id: 'react', column: 0, row: 0 },
        { id: 'shadcn', column: 1, row: 0 },
        { id: 'vite', column: 2, row: 0 },
        { id: 'mdn', column: 0, row: 1 },
        { id: 'action:add', column: 1, row: 1 },
      ],
    )
  })

  it('大分组和弹窗之间移动时保留顺序及网站总数', () => {
    const state = createWorkspace()
    state.items.push({ id: 'second', kind: 'folder', title: '其他', color: '#82976d', items: [] })
    const next = dropShortcut(state, 'react', {
      kind: 'folder',
      itemId: 'second',
      fallback: desktop,
    })
    expect(folder(next).items.map((item) => item.id)).toEqual(['mdn', 'shadcn', 'vite'])
    expect(folder(next, 'second').items.map((item) => item.id)).toEqual(['react'])
    expect(new Set(sites(next).map((item) => item.id)).size).toBe(sites(state).length)
    expect(
      dropShortcut(next, 'react', { kind: 'folder', itemId: 'second', fallback: desktop }),
    ).toBe(next)
  })

  it('移出后自动补位，桌面落点避开不同尺寸的小组件', () => {
    const state = createWorkspace()
    state.widgetSizes = { todo: '3x3', notes: '4x2' }
    const initial = [
      { ...widgetSizePresets.find((size) => size.id === '3x3')!, id: 'widget:todo' },
      { ...widgetSizePresets.find((size) => size.id === '4x2')!, id: 'widget:notes' },
      ...state.items.map((item) => ({
        ...getIconSize(item.id, item.kind, state.iconSizes),
        id: item.id,
      })),
    ]
    state.gridLayouts.desktop = {
      '8x4': positionsFromLayout(arrangeDesktop(initial, {}, 8, undefined, 4)),
    }
    const next = dropShortcut(state, 'react', { ...desktop, position: { column: 0, row: 0 } })
    expect(folder(next).items.map((item) => item.id)).toEqual(['mdn', 'shadcn', 'vite'])
    const positions = next.gridLayouts.desktop['8x4']
    expect(positions.react).toEqual({ column: 0, row: 0 })
    const layout = [...initial, { id: 'react', columns: 1, rows: 1 }].map((entry) => ({
      ...entry,
      ...positions[entry.id],
    }))
    expect(
      layout.every((entry, i) => layout.slice(i + 1).every((other) => !overlaps(entry, other))),
    ).toBe(true)
    expect(findShortcut(next.items, 'react')).toEqual(findShortcut(state.items, 'react'))
  })

  it('桌面图标叠放建组，沿用目标位置并保留组件排序', () => {
    const state = createWorkspace()
    state.desktopOrder = ['widget:todo', 'widget:notes', 'github', 'figma', 'tools']
    state.gridLayouts.desktop = {
      '8x4': {
        github: { column: 4, row: 0 },
        figma: { column: 5, row: 0 },
        'widget:todo': { column: 0, row: 0 },
      },
      '6x3': { github: { column: 4, row: 1 }, figma: { column: 5, row: 1 } },
    }
    const next = dropShortcut(state, 'github', {
      kind: 'shortcut',
      itemId: 'figma',
      fallback: desktop,
    })
    const created = next.items.find(
      (item) => item.kind === 'folder' && item.id !== 'tools',
    ) as Folder
    expect(created.items.map((item) => item.id)).toEqual(['figma', 'github'])
    expect(next.gridLayouts.desktop['8x4'][created.id]).toEqual({ column: 5, row: 0 })
    expect(next.gridLayouts.desktop['6x3'][created.id]).toEqual({ column: 5, row: 1 })
    expect(next.gridLayouts.desktop['8x4'].github).toBeUndefined()
    expect(next.desktopOrder.slice(0, 3)).toEqual(['widget:todo', 'widget:notes', created.id])
    expect(workspaceSchema.parse(next)).toEqual(next)
    expect(sites(next)).toHaveLength(sites(state).length)
  })

  it('从分组拖到桌面网站建组，同时移除原分组中的图标', () => {
    const state = createWorkspace()
    const next = dropShortcut(state, 'react', {
      kind: 'shortcut',
      itemId: 'figma',
      fallback: desktop,
    })
    expect(folder(next).items.map((item) => item.id)).toEqual(['mdn', 'shadcn', 'vite'])
    const created = next.items.find(
      (item) => item.kind === 'folder' && item.id !== 'tools',
    ) as Folder
    expect(created.items.map((item) => item.id)).toEqual(['figma', 'react'])
    expect(next.gridLayouts.desktop['8x4'][created.id]).toEqual(desktop.position)
    expect(new Set(sites(next).map((item) => item.id)).size).toBe(sites(state).length)
  })

  it('分组分页和列数变化始终保持连续顺序', () => {
    const ids = [...Array.from({ length: 31 }, (_, index) => `site:${index}`), 'action:add']
    for (const columns of [1, 3, 7]) {
      const layout = compactFolderLayout(ids, columns)
      expect(layout.map((entry) => entry.row * columns + entry.column)).toEqual(
        ids.map((_, index) => index),
      )
      expect(layout.at(-1)?.id).toBe('action:add')
    }
  })
})

describe('壁纸模糊设置', () => {
  it('旧备份默认不模糊，调整值可序列化并校验范围', () => {
    const state = createWorkspace()
    const oldSettings = Object.fromEntries(
      Object.entries(state.settings).filter(([key]) => key !== 'wallpaperBlur'),
    )
    expect(workspaceSchema.parse({ ...state, settings: oldSettings }).settings.wallpaperBlur).toBe(
      0,
    )
    state.settings.wallpaperBlur = 18
    expect(workspaceSchema.parse(JSON.parse(JSON.stringify(state))).settings.wallpaperBlur).toBe(18)
    for (const value of [-1, 31]) {
      expect(
        workspaceSchema.safeParse({
          ...state,
          settings: { ...state.settings, wallpaperBlur: value },
        }).success,
      ).toBe(false)
    }
  })
})
