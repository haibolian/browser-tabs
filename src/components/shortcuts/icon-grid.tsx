import { useEffect, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus } from 'lucide-react'
import type { DesktopItem, Workspace } from '@/lib/workspace'
import { getIconSize, type IconSize } from '@/lib/desktop-layout'
import { DesktopGrid, type DesktopGridProps } from './desktop-grid'
import { ItemVisual, SiteTile, type TileHandlers } from './site-tile'
export type { DesktopWidget } from './desktop-grid'

type FolderGridProps = TileHandlers & {
  items: DesktopItem[]
  folderId: string
  workspace: Workspace
  onReorder: (items: DesktopItem[]) => void
  onAdd: () => void
  onResizeIcon: (id: string, size: IconSize) => void
}

function SortableSite({
  item,
  props,
  columns,
}: {
  item: DesktopItem
  props: FolderGridProps
  columns: number
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  })
  const size = getIconSize(item.id, item.kind, props.workspace.iconSizes)
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        gridColumn: `span ${Math.min(size.columns, columns)}`,
        gridRow: `span ${size.rows}`,
      }}
    >
      <SiteTile
        {...props}
        item={item}
        folders={props.workspace.items.filter((entry) => entry.kind === 'folder')}
        currentFolderId={props.folderId}
        openInNewTab={props.workspace.settings.openInNewTab}
        drag={{ attributes, listeners }}
        isDragging={isDragging}
        size={size.id}
        onResize={(next) => props.onResizeIcon(item.id, next)}
        appearance={props.workspace.settings.icons}
      />
    </div>
  )
}
function FolderGrid(props: FolderGridProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(600)
  const appearance = props.workspace.settings.icons
  const columns = Math.max(
    1,
    Math.floor((width + appearance.gapX) / (appearance.size + appearance.gapX)),
  )
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(rootRef.current!)
    return () => observer.disconnect()
  }, [])
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 7 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const active = props.items.find((item) => item.id === activeId)
  const activeSize = active ? getIconSize(active.id, active.kind, props.workspace.iconSizes) : null
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(event) => setActiveId(String(event.active.id))}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={(event) => {
        setActiveId(null)
        if (!event.over || event.over.id === event.active.id) return
        const from = props.items.findIndex((item) => item.id === event.active.id)
        const to = props.items.findIndex((item) => item.id === event.over?.id)
        if (from >= 0 && to >= 0) props.onReorder(arrayMove(props.items, from, to))
      }}
    >
      <SortableContext items={props.items.map((item) => item.id)} strategy={rectSortingStrategy}>
        <div ref={rootRef} className="w-full">
          <div
            className="icon-grid grid"
            aria-label="分组网站"
            style={{
              gridTemplateColumns: `repeat(${columns}, ${appearance.size}px)`,
              gridAutoRows: appearance.size,
              columnGap: appearance.gapX,
              rowGap: appearance.gapY,
              paddingBottom: appearance.showName ? appearance.nameSize * 1.1 + 6 : 0,
            }}
          >
            {props.items.map((item) => (
              <SortableSite key={item.id} item={item} props={props} columns={columns} />
            ))}
            <button
              onClick={props.onAdd}
              aria-label="在分组中添加网站"
              className="site-launch relative block size-full"
            >
              <span className="action-icon flex items-center justify-center border border-dashed border-primary/20 bg-shortcut/40 text-primary/50">
                <Plus size={24} strokeWidth={1.4} />
              </span>
              <span className="tile-label action-label">添加网站</span>
            </button>
          </div>
        </div>
      </SortableContext>
      <DragOverlay dropAnimation={{ duration: 240 }}>
        {active && activeSize && (
          <ItemVisual
            item={active}
            size={activeSize.id}
            width={
              Math.min(activeSize.columns, columns) * (appearance.size + appearance.gapX) -
              appearance.gapX
            }
            height={activeSize.rows * (appearance.size + appearance.gapY) - appearance.gapY}
            overlay
            appearance={appearance}
          />
        )}
      </DragOverlay>
    </DndContext>
  )
}

export function IconGrid(props: DesktopGridProps | FolderGridProps) {
  return 'folderId' in props ? <FolderGrid {...props} /> : <DesktopGrid {...props} />
}
