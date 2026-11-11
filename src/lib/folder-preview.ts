import { iconSizePresets, type IconSize } from './desktop-layout'
import type { IconAppearance } from './icon-appearance'

export type FolderPreviewItem = {
  index: number
  left: number
  top: number
  size: number
  radius: number
  direct: boolean
  mini: boolean
}

const layouts = {
  '1x1': { columns: 2, rows: 2, inset: 0.3, radius: 4, direct: false },
  '2x1': { columns: 3, rows: 1, inset: 0.4, radius: 2, direct: false },
  '1x2': { columns: 1, rows: 3, inset: 0.4, radius: 2, direct: false },
  '2x2': { columns: 2, rows: 2, inset: 0.35, radius: 1.2, direct: true },
  '4x2': { columns: 4, rows: 2, inset: 0.5, radius: 1.2, direct: true },
} as const

export function getFolderPreview(
  size: IconSize,
  width: number,
  height: number,
  count: number,
  appearance: IconAppearance,
): FolderPreviewItem[] {
  const layout = layouts[size]
  const preset = iconSizePresets.find((entry) => entry.id === size)!
  const padding = appearance.size / (size === '1x1' ? 10 : 7)
  const contentWidth = width - padding * 2
  const contentHeight = height - padding * 2
  const nominalWidth = preset.columns * appearance.size + (preset.columns - 1) * appearance.gapX
  const nominalHeight = preset.rows * appearance.size + (preset.rows - 1) * appearance.gapY
  const slotSize = (boxWidth: number, boxHeight: number) =>
    Math.min(
      (boxWidth - padding * 2) / layout.columns,
      (boxHeight - (size === '4x2' ? appearance.size / 5 : padding * 2)) / layout.rows,
    )
  const slot = slotSize(width, height)
  const scale = slot / slotSize(nominalWidth, nominalHeight)
  const inset = appearance.nameSize * layout.inset * scale
  const columnGap =
    layout.columns > 1 ? (contentWidth - slot * layout.columns) / (layout.columns - 1) : 0
  const rowGap =
    layout.rows > 1 ? Math.max(0, (contentHeight - slot * layout.rows) / (layout.rows - 1)) : 0
  const startX = padding + (layout.columns === 1 ? (contentWidth - slot) / 2 : 0)
  const startY = padding + (layout.rows === 1 ? (contentHeight - slot) / 2 : 0)
  const items: FolderPreviewItem[] = []
  const radius = (side: number, divisor: number) =>
    appearance.shape === 'circle' ? side / 2 : (appearance.radius / divisor) * scale
  const primaryCount = size === '2x2' ? 3 : layout.columns * layout.rows
  for (let index = 0; index < Math.min(count, primaryCount); index++) {
    const side = slot - inset * 2
    items.push({
      index,
      left: startX + (index % layout.columns) * (slot + columnGap) + inset,
      top: startY + Math.floor(index / layout.columns) * (slot + rowGap) + inset,
      size: side,
      radius: radius(side, layout.radius),
      direct: layout.direct,
      mini: !layout.direct,
    })
  }
  if (size === '2x2') {
    const gap = appearance.nameSize * 0.45 * scale
    const side = (slot - inset * 2 - gap) / 2
    for (let index = 3; index < Math.min(count, 7); index++) {
      items.push({
        index,
        left: startX + slot + columnGap + inset + ((index - 3) % 2) * (side + gap),
        top: startY + slot + rowGap + inset + Math.floor((index - 3) / 2) * (side + gap),
        size: side,
        radius: radius(side, 2.5),
        direct: false,
        mini: true,
      })
    }
  }
  return items
}
