import { describe, expect, it } from 'vitest'
import { iconSizePresets } from './desktop-layout'
import { getFolderPreview } from './folder-preview'
import { iconAppearanceSchema } from './icon-appearance'

const appearance = iconAppearanceSchema.parse({})

describe('分组预览', () => {
  it('2×2 显示前三个可点击大图标，其余四个合并在右下角', () => {
    const items = getFolderPreview('2x2', 150, 150, 10, appearance)
    expect(items.map((item) => item.index)).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(items.filter((item) => item.direct).map((item) => item.index)).toEqual([0, 1, 2])
    expect(items.slice(3).every((item) => item.mini && item.left > 75 && item.top > 75)).toBe(true)
    expect(items[3].size).toBeLessThan(items[0].size / 2)
  })

  it('4×2 提供八个独立跳转入口', () => {
    const items = getFolderPreview('4x2', 330, 150, 12, appearance)
    expect(items).toHaveLength(8)
    expect(items.every((item) => item.direct && !item.mini)).toBe(true)
  })

  it.each(['2x1', '1x2'] as const)('%s 为三个紧凑缩略图，点击展开分组', (size) => {
    const items = getFolderPreview(
      size,
      size === '2x1' ? 150 : 60,
      size === '2x1' ? 60 : 150,
      8,
      appearance,
    )
    expect(items).toHaveLength(3)
    expect(items.every((item) => !item.direct && item.mini)).toBe(true)
    expect(
      size === '2x1'
        ? new Set(items.map((item) => item.top)).size
        : new Set(items.map((item) => item.left)).size,
    ).toBe(1)
  })

  it('空分组不生成占位网站，1×1 只显示四个缩略图', () => {
    expect(getFolderPreview('2x2', 150, 150, 0, appearance)).toEqual([])
    const items = getFolderPreview('1x1', 60, 60, 8, appearance)
    expect(items).toHaveLength(4)
    expect(items.every((item) => !item.direct)).toBe(true)
  })

  it.each([
    { size: 60, gapX: 30, gapY: 30, nameSize: 12 },
    { size: 90, gapX: 45, gapY: 45, nameSize: 18 },
    { size: 50, gapX: 0, gapY: 0, nameSize: 20 },
    { size: 100, gapX: 100, gapY: 0, nameSize: 20 },
    { size: 100, gapX: 0, gapY: 100, nameSize: 12 },
  ])('大小 $size、间距 $gapX/$gapY 时所有布局都不重叠、不越界', (settings) => {
    const options = { ...appearance, ...settings }
    for (const preset of iconSizePresets) {
      const width = preset.columns * options.size + (preset.columns - 1) * options.gapX
      const height = preset.rows * options.size + (preset.rows - 1) * options.gapY
      const items = getFolderPreview(preset.id, width, height, 12, options)
      for (const item of items) {
        expect(item.size).toBeGreaterThan(0)
        expect(item.left).toBeGreaterThanOrEqual(0)
        expect(item.top).toBeGreaterThanOrEqual(0)
        expect(item.left + item.size).toBeLessThanOrEqual(width + 0.001)
        expect(item.top + item.size).toBeLessThanOrEqual(height + 0.001)
      }
      for (let i = 0; i < items.length; i++)
        for (let j = i + 1; j < items.length; j++) {
          const a = items[i],
            b = items[j]
          expect(
            a.left < b.left + b.size - 0.001 &&
              a.left + a.size > b.left + 0.001 &&
              a.top < b.top + b.size - 0.001 &&
              a.top + a.size > b.top + 0.001,
          ).toBe(false)
        }
    }
  })

  it('窄窗口和布局切换中的尺寸仍可完整容纳预览', () => {
    for (const [width, height] of [
      [60, 60],
      [150, 150],
      [240, 150],
      [330, 150],
    ]) {
      const items = getFolderPreview('4x2', width, height, 8, appearance)
      expect(items).toHaveLength(8)
      expect(
        items.every(
          (item) =>
            item.size > 0 &&
            item.left >= 0 &&
            item.top >= 0 &&
            item.left + item.size <= width &&
            item.top + item.size <= height,
        ),
      ).toBe(true)
    }
  })
})
