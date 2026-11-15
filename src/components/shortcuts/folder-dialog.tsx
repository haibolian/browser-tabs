import { useEffect, useMemo, useRef, type ComponentProps } from 'react'
import { useDndMonitor } from '@dnd-kit/core'
import { getEventCoordinates } from '@dnd-kit/utilities'
import { DialogContent } from '@/components/ui/dialog'
import { useShortcutDrag, type TargetDragData } from './shortcut-drag-context'
import { createDragExitTimer } from '@/lib/drag-exit'

export function FolderDialogContent({
  folderId,
  onDragOutside,
  ...props
}: ComponentProps<typeof DialogContent> & { folderId: string | null; onDragOutside: () => void }) {
  const { activeId, activeItem, sourceFolderId } = useShortcutDrag()
  const panelRef = useRef<HTMLDivElement>(null)
  const outsidePanel = useRef(false)
  const exitTimer = useMemo(() => createDragExitTimer(onDragOutside), [onDragOutside])
  useEffect(() => () => exitTimer.cancel(), [exitTimer, folderId])
  useDndMonitor({
    onDragMove: (event) => {
      const panel = panelRef.current
      if (!panel || activeItem?.kind !== 'shortcut' || sourceFolderId !== folderId) {
        exitTimer.cancel()
        return
      }
      const start = getEventCoordinates(event.activatorEvent)
      const dragged = event.active.rect.current.translated
      const point = start
        ? { x: start.x + event.delta.x, y: start.y + event.delta.y }
        : dragged
          ? { x: dragged.left + dragged.width / 2, y: dragged.top + dragged.height / 2 }
          : null
      if (!point) return
      const bounds = panel.getBoundingClientRect()
      outsidePanel.current =
        point.x < bounds.left ||
        point.x > bounds.right ||
        point.y < bounds.top ||
        point.y > bounds.bottom
      exitTimer.update(outsidePanel.current)
    },
    onDragStart: () => {
      outsidePanel.current = false
      exitTimer.cancel()
    },
    onDragEnd: ({ over }) => {
      const drop = (over?.data.current as TargetDragData | undefined)?.drop
      const movedOut =
        drop &&
        (drop.kind === 'grid' || drop.kind === 'order'
          ? drop.folderId !== folderId
          : drop.kind === 'folder'
            ? drop.itemId !== folderId
            : true)
      if (
        activeItem?.kind === 'shortcut' &&
        sourceFolderId === folderId &&
        outsidePanel.current &&
        movedOut
      )
        exitTimer.update(true)
      else exitTimer.cancel()
    },
    onDragCancel: () => exitTimer.cancel(),
  })
  return (
    <DialogContent
      ref={panelRef}
      {...props}
      onEscapeKeyDown={(event) => {
        if (activeId) event.preventDefault()
      }}
    />
  )
}
