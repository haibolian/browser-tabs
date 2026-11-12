export const widgetSizePresets = [
  { id: '2x2', label: '紧凑', columns: 2, rows: 2 },
  { id: '3x2', label: '横向', columns: 3, rows: 2 },
  { id: '3x3', label: '方形', columns: 3, rows: 3 },
  { id: '4x2', label: '宽幅', columns: 4, rows: 2 },
  { id: '4x3', label: '大卡片', columns: 4, rows: 3 },
] as const

export type WidgetSize = (typeof widgetSizePresets)[number]['id']
export const iconSizePresets = [
  { id: '1x1', columns: 1, rows: 1 },
  { id: '2x1', columns: 2, rows: 1 },
  { id: '1x2', columns: 1, rows: 2 },
  { id: '2x2', columns: 2, rows: 2 },
  { id: '4x2', columns: 4, rows: 2 },
] as const
export type IconSize = (typeof iconSizePresets)[number]['id']

export function getIconSize(
  id: string,
  kind: 'shortcut' | 'folder',
  sizes: Record<string, IconSize>,
) {
  const size = sizes[id] ?? (kind === 'folder' ? '2x2' : '1x1')
  return iconSizePresets.find((preset) => preset.id === size)!
}
export type GridPosition = { column: number; row: number }
export type GridEntry = { id: string; columns: number; rows: number }
export type PlacedEntry = GridEntry & GridPosition
export type GridPositions = Record<string, GridPosition>
export type GridLayouts = Record<string, GridPositions>

export function getGridTrackCount(available: number, size: number, gap: number, labelHeight = 0) {
  // Browser layout rounds fractional CSS pixels; allow one layout subpixel at the boundary.
  return Math.max(1, Math.floor((available - labelHeight + gap + 1 / 64) / (size + gap)))
}

export function gridLayoutKey(columns: number, rows: number) {
  return `${columns}x${rows}`
}

export function responsiveGridPositions(
  layouts: GridLayouts,
  columns: number,
  rows: number,
  legacy: GridPositions = {},
): GridPositions {
  const exact = layouts[gridLayoutKey(columns, rows)]
  if (exact) return exact
  const candidates = Object.entries(layouts).map(([key, positions]) => {
    const [width, height] = key.split('x').map(Number)
    return { width, height, positions }
  })
  candidates.sort(
    (a, b) =>
      Math.abs(a.width - columns) - Math.abs(b.width - columns) ||
      b.width - a.width ||
      Math.abs(a.height - rows) - Math.abs(b.height - rows),
  )
  const reference = candidates[0]
  if (!reference) return legacy
  return Object.fromEntries(
    Object.entries(reference.positions).map(([id, position]) => [
      id,
      {
        column: position.column,
        row:
          Math.floor(position.row / reference.height) * rows +
          Math.min(position.row % reference.height, rows - 1),
      },
    ]),
  )
}

export function gridTarget(
  column: number,
  row: number,
  entry: GridEntry,
  columns: number,
  rows: number,
  page: number,
): GridPosition {
  return {
    column: Math.max(0, Math.min(columns - Math.min(entry.columns, columns), Math.round(column))),
    row: page * rows + Math.max(0, Math.min(rows - Math.min(entry.rows, rows), Math.round(row))),
  }
}

export function overlaps(a: PlacedEntry, b: PlacedEntry) {
  return (
    a.column < b.column + b.columns &&
    a.column + a.columns > b.column &&
    a.row < b.row + b.rows &&
    a.row + a.rows > b.row
  )
}

// Explicit cells allow a large widget to occupy empty cells on the right.
// The moved item keeps its target; only colliding items are placed in free cells.
export function arrangeDesktop(
  entries: GridEntry[],
  saved: Record<string, GridPosition>,
  columns: number,
  preferredId?: string,
  rowsPerPage?: number,
): PlacedEntry[] {
  if (!Number.isInteger(columns) || columns < 1) throw new Error('网格列数必须是正整数')
  if (rowsPerPage !== undefined && (!Number.isInteger(rowsPerPage) || rowsPerPage < 1))
    throw new Error('网格行数必须是正整数')
  const placed: PlacedEntry[] = []
  const pending: GridEntry[] = []
  const ordered = preferredId
    ? [
        ...entries.filter((entry) => entry.id === preferredId),
        ...entries.filter((entry) => entry.id !== preferredId),
      ]
    : entries
  for (const entry of ordered) {
    const size = {
      ...entry,
      columns: Math.min(entry.columns, columns),
      rows: Math.min(entry.rows, rowsPerPage ?? entry.rows),
    }
    const position = saved[entry.id]
    if (position) {
      const candidate = {
        ...size,
        column: Math.min(position.column, columns - size.columns),
        row:
          rowsPerPage === undefined
            ? position.row
            : Math.floor(position.row / rowsPerPage) * rowsPerPage +
              Math.min(position.row % rowsPerPage, rowsPerPage - size.rows),
      }
      if (!placed.some((other) => overlaps(candidate, other))) {
        placed.push(candidate)
        continue
      }
    }
    pending.push(size)
  }
  for (const entry of pending) {
    let row = 0
    let location: PlacedEntry | undefined
    while (!location) {
      if (rowsPerPage !== undefined && (row % rowsPerPage) + entry.rows > rowsPerPage) {
        row += rowsPerPage - (row % rowsPerPage)
        continue
      }
      for (let column = 0; column <= columns - entry.columns; column++) {
        const candidate = { ...entry, column, row }
        if (!placed.some((other) => overlaps(candidate, other))) {
          location = candidate
          break
        }
      }
      row++
    }
    placed.push(location)
  }
  return entries.map((entry) => placed.find((item) => item.id === entry.id)!)
}

export function positionsFromLayout(layout: PlacedEntry[]) {
  return Object.fromEntries(layout.map((item) => [item.id, { column: item.column, row: item.row }]))
}
