import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type KeyboardCoordinateGetter,
} from '@dnd-kit/core'
import type { Workspace, UpdateWorkspace } from '@/lib/workspace'
import { dropShortcut } from '@/lib/shortcut-drag'
import { folderAppearanceStyle, iconAppearanceStyle } from '@/lib/icon-appearance'
import { ItemVisual } from './site-tile'
import { getIconSize } from '@/lib/desktop-layout'
import {
  ShortcutDragContext,
  type GridDragData,
  type ShortcutDragData,
  type TargetDragData,
} from './shortcut-drag-context'

const collisionDetection: CollisionDetection = (args) => {
  const point = args.pointerCoordinates ?? {
    x: args.collisionRect.left + args.collisionRect.width / 2,
    y: args.collisionRect.top + args.collisionRect.height / 2,
  }
  const surfaces = args.droppableContainers.filter((container) => {
    if (container.data.current?.kind !== 'surface') return false
    const rect = container.data.current?.folderId
      ? container.node.current?.closest('.folder-panel')?.getBoundingClientRect()
      : args.droppableRects.get(container.id)
    return (
      rect &&
      point.x >= rect.left &&
      point.x <= rect.right &&
      point.y >= rect.top &&
      point.y <= rect.bottom
    )
  })
  surfaces.sort((a, b) => Number(!!b.data.current?.folderId) - Number(!!a.data.current?.folderId))
  const surface = surfaces[0]?.data.current as GridDragData | undefined
  return surface?.collision(args) ?? []
}

export function ShortcutDnd({
  workspace,
  update,
  children,
}: {
  workspace: Workspace
  update: UpdateWorkspace
  children: ReactNode
}) {
  const [active, setActive] = useState<(ShortcutDragData & { id: string }) | null>(null)
  const [readyId, setReadyId] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const candidate = useRef<string | null>(null)
  const ready = useRef<string | null>(null)
  const sourceData = useRef<ShortcutDragData>({})
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )
  const stepX = workspace.settings.icons.size + workspace.settings.icons.gapX
  const stepY = workspace.settings.icons.size + workspace.settings.icons.gapY
  const keyboardCoordinates: KeyboardCoordinateGetter = (event, { currentCoordinates }) => {
    const delta = {
      ArrowRight: [stepX, 0],
      ArrowLeft: [-stepX, 0],
      ArrowDown: [0, stepY],
      ArrowUp: [0, -stepY],
    }[event.code]
    if (!delta) return
    event.preventDefault()
    return { x: currentCoordinates.x + delta[0], y: currentCoordinates.y + delta[1] }
  }
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 7 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: keyboardCoordinates,
      scrollBehavior: 'auto',
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] },
    }),
  )
  function clearCandidate() {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    candidate.current = null
    ready.current = null
    setReadyId(null)
  }
  function finish() {
    clearCandidate()
    setActive(null)
    sourceData.current = {}
  }
  return (
    <ShortcutDragContext.Provider
      value={{
        activeId: active?.id ?? null,
        activeItem: active?.item ?? null,
        sourceFolderId: active?.folderId ?? null,
        readyId,
      }}
    >
      <DndContext
        sensors={sensors}
        autoScroll={false}
        collisionDetection={(args) =>
          collisionDetection({
            ...args,
            active: { ...args.active, data: { current: sourceData.current } },
          })
        }
        onDragStart={({ active }) => {
          clearCandidate()
          sourceData.current = { ...active.data.current }
          setActive({ ...sourceData.current, id: String(active.id) })
        }}
        onDragOver={({ over }) => {
          const drop = (over?.data.current as TargetDragData | undefined)?.drop
          const next = drop?.kind === 'shortcut' ? drop.itemId : null
          if (candidate.current === next) return
          clearCandidate()
          candidate.current = next
          if (next)
            timer.current = setTimeout(() => {
              ready.current = next
              setReadyId(next)
            }, 450)
        }}
        onDragCancel={finish}
        onDragEnd={({ active, over }) => {
          const item =
            sourceData.current.item ?? (active.data.current as ShortcutDragData | undefined)?.item
          const drop = (over?.data.current as TargetDragData | undefined)?.drop
          if (item?.kind === 'shortcut' && drop) {
            const target =
              drop.kind === 'shortcut' && ready.current !== drop.itemId ? drop.fallback : drop
            update((state) => dropShortcut(state, item.id, target))
          }
          finish()
        }}
        accessibility={{
          screenReaderInstructions: {
            draggable:
              '按空格抓起，方向键移动，空格放下，Escape 取消。拖到网站中央停留可创建分组。',
          },
        }}
      >
        {children}
        {createPortal(
          <DragOverlay dropAnimation={null} zIndex={100}>
            {active?.item && (
              <div
                className="shortcut-drag-overlay size-full"
                style={{
                  ...iconAppearanceStyle(workspace.settings.icons),
                  ...(active.folderId ? folderAppearanceStyle(workspace.settings.icons) : {}),
                }}
              >
                <ItemVisual
                  item={active.item}
                  size={getIconSize(active.item.id, active.item.kind, workspace.iconSizes).id}
                  appearance={workspace.settings.icons}
                  showLabel={active.surface !== 'preview'}
                  mini={active.mini}
                />
              </div>
            )}
          </DragOverlay>,
          document.body,
        )}
      </DndContext>
    </ShortcutDragContext.Provider>
  )
}
