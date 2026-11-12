import { describe, expect, it } from 'vitest'
import {
  arrangeDesktop,
  iconSizePresets,
  overlaps,
  positionsFromLayout,
  widgetSizePresets,
  gridLayoutKey,
  getGridTrackCount,
  gridTarget,
  responsiveGridPositions,
} from './desktop-layout'
import { createWorkspace, workspaceSchema } from './workspace'

const entries = [
  { id: 'todo', columns: 2, rows: 2 },
  { id: 'notes', columns: 2, rows: 2 },
  ...Array.from({ length: 12 }, (_, i) => ({ id: `site:${i}`, columns: 1, rows: 1 })),
]

describe('可定位的混合网格', () => {
  it('两个小组件的 2×3 布局可保存恢复，在右下边界放置时不跨页或重叠', () => {
    const size = widgetSizePresets.find((preset) => preset.id === '2x3')!
    const workspace = createWorkspace()
    workspace.widgetSizes = { todo: size.id, notes: size.id }
    expect(workspaceSchema.parse(JSON.parse(JSON.stringify(workspace))).widgetSizes).toEqual({
      todo: '2x3',
      notes: '2x3',
    })
    const widgets = entries.map((entry) =>
      ['todo', 'notes'].includes(entry.id)
        ? { ...entry, columns: size.columns, rows: size.rows }
        : entry,
    )
    const placed = arrangeDesktop(
      widgets,
      { todo: { column: 5, row: 2 }, notes: { column: 5, row: 2 } },
      6,
      'todo',
      4,
    )
    expect(placed[0]).toMatchObject({ column: 4, row: 1, columns: 2, rows: 3 })
    expect(
      placed.every(
        (entry) => entry.column + entry.columns <= 6 && (entry.row % 4) + entry.rows <= 4,
      ),
    ).toBe(true)
    expect(
      placed.every((entry, index) =>
        placed.slice(index + 1).every((other) => !overlaps(entry, other)),
      ),
    ).toBe(true)
    expect(arrangeDesktop(widgets, positionsFromLayout(placed), 6, undefined, 4)).toEqual(placed)
  })
  it('小数像素取整不会丢掉刚好容纳的槽位，也不会多算不足一行的空间', () => {
    expect(getGridTrackCount(169.1979217529297, 60, 30, 19.2)).toBe(2)
    expect(getGridTrackCount(689.99, 60, 30)).toBe(8)
    expect(getGridTrackCount(168.2, 60, 30, 19.2)).toBe(1)
    expect(getGridTrackCount(0, 60, 30, 19.2)).toBe(1)
  })

  it('待办和随手记的 3×3 尺寸可保存、恢复及放置在右缘', () => {
    const size = widgetSizePresets.find((preset) => preset.id === '3x3')!
    const workspace = createWorkspace()
    workspace.widgetSizes = { todo: '3x3', notes: '3x3' }
    expect(workspaceSchema.parse(JSON.parse(JSON.stringify(workspace))).widgetSizes).toEqual({
      todo: '3x3',
      notes: '3x3',
    })
    const next = arrangeDesktop(
      [
        { id: 'todo', columns: size.columns, rows: size.rows },
        { id: 'notes', columns: size.columns, rows: size.rows },
        { id: 'site', columns: 1, rows: 1 },
      ],
      { todo: { column: 9, row: 0 }, notes: { column: 9, row: 0 } },
      12,
      'todo',
    )
    expect(next[0]).toMatchObject({ column: 9, row: 0, columns: 3, rows: 3 })
    expect(
      next.every((entry, index) => next.slice(index + 1).every((other) => !overlaps(entry, other))),
    ).toBe(true)
  })
  it.each(iconSizePresets)('网站切换为 $id 时可对齐最右侧，并且不会覆盖组件或其他网站', (size) => {
    const resized = entries.map((entry) =>
      entry.id === 'site:0' ? { ...entry, columns: size.columns, rows: size.rows } : entry,
    )
    const saved = positionsFromLayout(arrangeDesktop(entries, {}, 12))
    const next = arrangeDesktop(
      resized,
      { ...saved, 'site:0': { column: 12 - size.columns, row: 0 } },
      12,
      'site:0',
    )
    expect(next.find((entry) => entry.id === 'site:0')).toMatchObject({
      column: 12 - size.columns,
      row: 0,
      columns: size.columns,
      rows: size.rows,
    })
    expect(next).toHaveLength(entries.length)
    for (let i = 0; i < next.length; i++)
      for (let j = i + 1; j < next.length; j++) expect(overlaps(next[i], next[j])).toBe(false)
  })
  it('允许小组件移动到最右侧，右缘准确对齐最后一列', () => {
    const initial = arrangeDesktop(entries, {}, 12)
    const next = arrangeDesktop(
      entries,
      { ...positionsFromLayout(initial), todo: { column: 10, row: 0 } },
      12,
      'todo',
    )
    expect(next.find((entry) => entry.id === 'todo')).toMatchObject({
      column: 10,
      row: 0,
      columns: 2,
    })
    for (let i = 0; i < next.length; i++)
      for (let j = i + 1; j < next.length; j++) expect(overlaps(next[i], next[j])).toBe(false)
  })
  it('空白处也是有效位置，不要求附近已有图标', () => {
    const next = arrangeDesktop(entries, { todo: { column: 8, row: 7 } }, 12, 'todo')
    expect(next.find((entry) => entry.id === 'todo')).toMatchObject({ column: 8, row: 7 })
  })
  it('改变尺寸时保留目标位置，并安置被覆盖的网站', () => {
    const initial = arrangeDesktop(entries, {}, 12)
    const larger = entries.map((entry) =>
      entry.id === 'notes' ? { ...entry, columns: 4, rows: 3 } : entry,
    )
    const next = arrangeDesktop(larger, positionsFromLayout(initial), 12, 'notes')
    expect(next.find((entry) => entry.id === 'notes')).toMatchObject({
      column: 2,
      row: 0,
      columns: 4,
      rows: 3,
    })
    expect(next).toHaveLength(entries.length)
    for (let i = 0; i < next.length; i++)
      for (let j = i + 1; j < next.length; j++) expect(overlaps(next[i], next[j])).toBe(false)
  })
  it('窄窗口重新排布不越界，原始宽屏坐标不会被改写', () => {
    const saved = { todo: { column: 10, row: 0 }, notes: { column: 8, row: 0 } }
    const next = arrangeDesktop(entries, saved, 4)
    expect(next.every((entry) => entry.column >= 0 && entry.column + entry.columns <= 4)).toBe(true)
    expect(saved.todo.column).toBe(10)
  })
})

describe('分页槽位与自适应布局', () => {
  it('窄屏移动后恢复原有宽屏布局，旧坐标不被覆盖', () => {
    const wide = arrangeDesktop(entries, { todo: { column: 10, row: 0 } }, 12, undefined, 4)
    const original = positionsFromLayout(wide)
    const profiles = { [gridLayoutKey(12, 4)]: original }
    const narrow = arrangeDesktop(entries, responsiveGridPositions(profiles, 4, 3), 4, undefined, 3)
    const edited = arrangeDesktop(
      entries,
      { ...positionsFromLayout(narrow), 'site:0': { column: 3, row: 5 } },
      4,
      'site:0',
      3,
    )
    const saved = { ...profiles, [gridLayoutKey(4, 3)]: positionsFromLayout(edited) }
    expect(
      arrangeDesktop(entries, responsiveGridPositions(saved, 12, 4), 12, undefined, 4),
    ).toEqual(wide)
    expect(profiles['12x4']).toEqual(original)
    expect(responsiveGridPositions(saved, 4, 3)['site:0']).toEqual({ column: 3, row: 5 })
  })

  it('大图标不跨页，所有图标都保留且不超出预设槽位', () => {
    const mixed = [
      { id: 'large', columns: 4, rows: 3 },
      { id: 'wide', columns: 4, rows: 2 },
      ...Array.from({ length: 50 }, (_, index) => ({ id: String(index), columns: 1, rows: 1 })),
    ]
    const result = arrangeDesktop(mixed, { large: { column: 4, row: 2 } }, 5, 'large', 3)
    expect(result).toHaveLength(mixed.length)
    expect(
      result.every(
        (entry) => entry.column + entry.columns <= 5 && (entry.row % 3) + entry.rows <= 3,
      ),
    ).toBe(true)
    for (let i = 0; i < result.length; i++)
      for (let j = i + 1; j < result.length; j++) expect(overlaps(result[i], result[j])).toBe(false)
  })

  it('越界拖动停在当前页边缘，不生成额外行列', () => {
    const item = { id: 'widget', columns: 3, rows: 2 }
    expect(gridTarget(-100, -100, item, 8, 4, 2)).toEqual({ column: 0, row: 8 })
    expect(gridTarget(100, 100, item, 8, 4, 2)).toEqual({ column: 5, row: 10 })
    expect(gridTarget(100, 100, item, 2, 1, 1)).toEqual({ column: 0, row: 1 })
  })

  it('桌面与分组的不同网格布局分别随备份保存，旧备份可读取', () => {
    const state = createWorkspace()
    state.gridLayouts = {
      desktop: {
        '12x4': { github: { column: 10, row: 1 } },
        '4x3': { github: { column: 1, row: 3 } },
      },
      'folder:tools': { '6x3': { mdn: { column: 3, row: 0 } } },
    }
    expect(workspaceSchema.parse(JSON.parse(JSON.stringify(state))).gridLayouts).toEqual(
      state.gridLayouts,
    )
    expect(workspaceSchema.parse({ ...state, gridLayouts: undefined }).gridLayouts).toEqual({})
  })

  it('新网格投影保留分页关系，已有布局对象不被改写', () => {
    const profiles = { '12x5': { a: { column: 11, row: 8 } } }
    expect(responsiveGridPositions(profiles, 4, 3).a).toEqual({ column: 11, row: 5 })
    expect(profiles['12x5'].a).toEqual({ column: 11, row: 8 })
    expect(() => arrangeDesktop(entries, {}, 4, undefined, 0)).toThrow('网格行数必须是正整数')
  })
})
