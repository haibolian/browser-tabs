import {
  arrangeDesktop,
  getIconSize,
  positionsFromLayout,
  responsiveGridPositions,
  widgetSizePresets,
  type GridPosition,
  type GridEntry,
} from './desktop-layout'
import {
  createId,
  findShortcut,
  getDesktopOrder,
  moveShortcut,
  type Folder,
  type Workspace,
  type Shortcut,
} from './workspace'

export type GridDrop = {
  kind: 'grid'
  folderId: string | null
  layoutKey: string
  position: GridPosition
  index: number
}

export type ItemDrop = {
  kind: 'folder' | 'shortcut'
  itemId: string
  fallback: GridDrop
}

export type FolderOrderDrop = { kind: 'order'; folderId: string; index: number }
export type ShortcutDrop = GridDrop | ItemDrop | FolderOrderDrop

export function compactFolderLayout(ids: string[], columns: number) {
  return ids.map((id, index) => ({
    id,
    columns: 1,
    rows: 1,
    column: index % columns,
    row: Math.floor(index / columns),
  }))
}

export function reorderFolder(ids: string[], id: string, index: number) {
  const next = ids.filter((entry) => entry !== id)
  next.splice(Math.max(0, Math.min(index, next.length)), 0, id)
  return next
}

export function dropShortcut(state: Workspace, id: string, target: ShortcutDrop): Workspace {
  const shortcut = findShortcut(state.items, id)
  if (!shortcut) return state
  const source = state.items.find(
    (item) => item.kind === 'folder' && item.items.some((child) => child.id === id),
  )
  if (target.kind === 'folder') {
    if (source?.id === target.itemId) return state
    return { ...state, items: moveShortcut(state.items, id, target.itemId) }
  }
  if (target.kind === 'shortcut') {
    const other = state.items.find(
      (item): item is Shortcut => item.id === target.itemId && item.kind === 'shortcut',
    )
    if (!other || other.id === id) return state
    const folder: Folder = {
      id: createId(),
      kind: 'folder',
      title: '新建分组',
      color: '#82976d',
      items: [other, shortcut],
    }
    const items = moveShortcut(state.items, id, null)
      .filter((item) => item.id !== id)
      .map((item) => (item.id === other.id ? folder : item))
    const profiles = { ...state.gridLayouts.desktop }
    if (!profiles[target.fallback.layoutKey]) {
      const [columns, rows] = target.fallback.layoutKey.split('x').map(Number)
      profiles[target.fallback.layoutKey] = responsiveGridPositions(
        profiles,
        columns,
        rows,
        state.desktopPositions,
      )
    }
    const desktopLayouts = Object.fromEntries(
      Object.entries(profiles).map(([key, positions]) => {
        const next = { ...positions }
        const position = next[other.id] ?? target.fallback.position
        delete next[id]
        delete next[other.id]
        next[folder.id] = position
        return [key, next]
      }),
    )
    return {
      ...state,
      items,
      iconSizes: { ...state.iconSizes, [folder.id]: '1x1' },
      desktopOrder: getDesktopOrder(state.desktopOrder, [
        ...(state.settings.showWidgets ? ['widget:todo', 'widget:notes'] : []),
        ...state.items.map((item) => item.id),
      ])
        .filter((entry) => entry !== id)
        .map((entry) => (entry === other.id ? folder.id : entry)),
      gridLayouts: { ...state.gridLayouts, desktop: desktopLayouts },
    }
  }
  if (target.kind === 'order' || (target.kind === 'grid' && target.folderId)) {
    const items =
      source?.id === target.folderId ? state.items : moveShortcut(state.items, id, target.folderId)
    return {
      ...state,
      items: items.map((item) => {
        if (item.kind !== 'folder' || item.id !== target.folderId) return item
        const order = reorderFolder(
          item.items.map((child) => child.id),
          id,
          target.index,
        )
        return {
          ...item,
          items: order.map((entry) => item.items.find((child) => child.id === entry)!),
        }
      }),
    }
  }
  if (target.kind !== 'grid') return state
  const items = source ? moveShortcut(state.items, id, null) : state.items
  const [columns, rows] = target.layoutKey.split('x').map(Number)
  const widgets = state.settings.showWidgets
    ? (['todo', 'notes'] as const).map((key) => ({
        ...widgetSizePresets.find((size) => size.id === state.widgetSizes[key])!,
        id: `widget:${key}`,
      }))
    : []
  const order = getDesktopOrder(state.desktopOrder, [
    ...widgets.map((item) => item.id),
    ...items.map((item) => item.id),
  ])
  const entries: GridEntry[] = order.map((entryId) => {
    const widget = widgets.find((item) => item.id === entryId)
    if (widget) return widget
    const item = items.find((item) => item.id === entryId)!
    return { ...getIconSize(item.id, item.kind, state.iconSizes), id: entryId }
  })
  const saved = responsiveGridPositions(
    state.gridLayouts.desktop ?? {},
    columns,
    rows,
    state.desktopPositions,
  )
  const positions = positionsFromLayout(
    arrangeDesktop(entries, { ...saved, [id]: target.position }, columns, id, rows),
  )
  return {
    ...state,
    items,
    gridLayouts: {
      ...state.gridLayouts,
      desktop: { ...state.gridLayouts.desktop, [target.layoutKey]: positions },
    },
  }
}
