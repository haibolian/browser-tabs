import { describe, expect, it } from 'vitest'
import { arrangeDesktop, iconSizePresets, overlaps, positionsFromLayout } from './desktop-layout'

const entries = [
  { id: 'todo', columns: 2, rows: 2 },
  { id: 'notes', columns: 2, rows: 2 },
  ...Array.from({ length: 12 }, (_, i) => ({ id: `site:${i}`, columns: 1, rows: 1 })),
]

describe('可定位的混合网格', () => {
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
