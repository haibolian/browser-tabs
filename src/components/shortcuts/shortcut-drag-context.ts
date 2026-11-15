import { createContext, useContext } from 'react'
import type { CollisionDetection } from '@dnd-kit/core'
import type { DesktopItem } from '@/lib/workspace'
import type { ShortcutDrop } from '@/lib/shortcut-drag'

export type ShortcutDragData = {
  item?: DesktopItem
  folderId?: string | null
  surface?: string
  mini?: boolean
}
export type GridDragData = {
  kind: 'surface'
  folderId: string | null
  collision: CollisionDetection
}
export type TargetDragData = { drop: ShortcutDrop }

export const ShortcutDragContext = createContext<{
  activeId: string | null
  activeItem: DesktopItem | null
  sourceFolderId: string | null
  readyId: string | null
}>({ activeId: null, activeItem: null, sourceFolderId: null, readyId: null })

export function useShortcutDrag() {
  return useContext(ShortcutDragContext)
}
