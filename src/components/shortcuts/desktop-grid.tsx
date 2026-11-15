import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
  type RefObject,
} from 'react'
import { useDndMonitor, useDraggable, useDroppable, type CollisionDetection } from '@dnd-kit/core'
import { CSS, type Transform } from '@dnd-kit/utilities'
import { motion } from 'motion/react'
import { Check, ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  arrangeDesktop,
  positionsFromLayout,
  widgetSizePresets,
  type PlacedEntry,
  type WidgetSize,
  type IconSize,
  getIconSize,
  iconSizePresets,
  gridLayoutKey,
  getGridTrackCount,
  gridTarget,
  responsiveGridPositions,
  type GridPositions,
} from '@/lib/desktop-layout'
import { getDesktopOrder, type DesktopItem, type Workspace } from '@/lib/workspace'
import { SiteTile, type TileHandlers } from './site-tile'
import { WidgetDragContext } from '@/components/widgets/widget-drag-context'
import { ActionVisual } from './action-visual'
import {
  compactFolderLayout,
  reorderFolder,
  type GridDrop,
  type ShortcutDrop,
} from '@/lib/shortcut-drag'
import { useShortcutDrag, type TargetDragData } from './shortcut-drag-context'

type TilePosition = { left: number; top: number; width: number; height: number; hidden?: boolean }

function useDragClickGuard(isDragging: boolean) {
  const dragged = useRef(false)
  const active = useRef(false)
  useEffect(() => {
    active.current = isDragging
    if (isDragging) dragged.current = true
  }, [isDragging])
  useEffect(() => {
    const reset = () => {
      dragged.current = false
    }
    const keyDown = () => {
      if (!active.current) reset()
    }
    const click = (event: MouseEvent) => {
      if (!dragged.current) return
      event.preventDefault()
      event.stopPropagation()
      dragged.current = false
    }
    // Cancel the link default before dnd-kit stops click propagation at the document.
    window.addEventListener('click', click, true)
    window.addEventListener('pointerdown', reset, true)
    window.addEventListener('keydown', keyDown, true)
    return () => {
      window.removeEventListener('click', click, true)
      window.removeEventListener('pointerdown', reset, true)
      window.removeEventListener('keydown', keyDown, true)
    }
  }, [])
}

function draggableStyle(
  position: TilePosition,
  dragging: boolean,
  isDragging: boolean,
  transform: Transform | null,
): CSSProperties {
  return {
    left: position.left,
    top: position.top,
    width: position.width,
    height: position.height,
    display: position.hidden ? 'none' : undefined,
    transform: dragging && isDragging ? CSS.Translate.toString(transform) : undefined,
    zIndex: dragging && isDragging ? 50 : undefined,
    transition: dragging && !isDragging ? 'left 150ms, top 150ms' : undefined,
  }
}

export type DesktopWidget = {
  id: string
  label: string
  sizeKey: keyof Workspace['widgetSizes']
  content: ReactNode
}

function CellTarget({ id, drop, style }: { id: string; drop: GridDrop; style: CSSProperties }) {
  const { setNodeRef } = useDroppable({
    id,
    data: { drop },
  })
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="slot-cell pointer-events-none absolute rounded-xl"
      aria-hidden
    />
  )
}

function DraggableSite({
  item,
  position,
  workspace,
  handlers,
  dragging,
  folderId,
  onResize,
  dropTarget,
}: {
  item: DesktopItem
  position: TilePosition
  workspace: Workspace
  handlers: TileHandlers
  dragging: boolean
  folderId?: string
  onResize: (size: IconSize) => void
  dropTarget: ShortcutDrop
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `grid:${folderId ?? 'desktop'}:${item.id}`,
    data: { item, folderId: folderId ?? null },
  })
  const drop = useDroppable({
    id: `target:${folderId ?? 'desktop'}:${item.id}`,
    data: { drop: dropTarget },
    disabled: !!folderId || position.hidden,
  })
  const { activeItem, readyId } = useShortcutDrag()
  const hiddenSource = activeItem?.id === item.id
  return (
    <div
      ref={(node) => {
        setNodeRef(node)
        drop.setNodeRef(node)
      }}
      data-grid-id={item.id}
      data-dragging={dragging && isDragging}
      style={{
        ...draggableStyle(position, dragging, false, null),
        opacity: hiddenSource ? 0 : 1,
        pointerEvents: hiddenSource ? 'none' : undefined,
        transition: dragging ? 'left 150ms ease, top 150ms ease' : undefined,
      }}
      className="absolute min-w-0"
    >
      <SiteTile
        {...handlers}
        item={item}
        folders={workspace.items.filter((entry) => entry.kind === 'folder')}
        currentFolderId={folderId ?? null}
        openInNewTab={workspace.settings.openInNewTab}
        drag={{ attributes, listeners }}
        isOver={drop.isOver && (item.kind === 'folder' || readyId === item.id)}
        size={folderId ? '1x1' : getIconSize(item.id, item.kind, workspace.iconSizes).id}
        onResize={onResize}
        appearance={workspace.settings.icons}
      />
    </div>
  )
}

function DraggableWidget({
  widget,
  position,
  size,
  dragging,
  onResize,
}: {
  widget: DesktopWidget
  position: TilePosition
  size: WidgetSize
  dragging: boolean
  onResize: (size: WidgetSize) => void
}) {
  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({
    id: widget.id,
  })
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={setNodeRef}
          data-grid-id={widget.id}
          data-dragging={dragging && isDragging}
          className="desktop-widget absolute min-h-0"
          style={draggableStyle(position, dragging, isDragging, transform)}
        >
          <WidgetDragContext.Provider value={{ attributes, listeners, label: widget.label }}>
            <div className="h-full min-h-0">{widget.content}</div>
          </WidgetDragContext.Provider>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent aria-label={`${widget.label}尺寸菜单`}>
        {widgetSizePresets.map((preset) => (
          <ContextMenuItem key={preset.id} onAction={() => onResize(preset.id)}>
            <Maximize2 />
            {preset.label}
            <span className="ml-auto pl-4 text-[10px] text-muted-foreground">
              {preset.columns} × {preset.rows}
            </span>
            {size === preset.id && <Check className="text-primary" />}
          </ContextMenuItem>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  )
}

function FolderAddTile({ position, onAdd }: { position: TilePosition; onAdd: () => void }) {
  return (
    <div
      data-grid-id="action:add"
      className="absolute"
      style={draggableStyle(position, false, false, null)}
    >
      <button
        type="button"
        onClick={onAdd}
        aria-label="在分组中添加网站"
        className="site-launch relative block size-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <ActionVisual label="添加网站" />
      </button>
    </div>
  )
}

export type DesktopGridProps = TileHandlers & {
  items: DesktopItem[]
  workspace: Workspace
  widgets?: DesktopWidget[]
  folderId?: string
  arrangeRef?: RefObject<(() => void) | null>
  onAdd: () => void
  onPositionsChange: (key: string, positions: GridPositions, moved?: boolean) => void
  onWidgetSizeChange?: (
    key: keyof Workspace['widgetSizes'],
    size: WidgetSize,
    layoutKey: string,
    positions: GridPositions,
  ) => void
  onIconSizeChange: (
    id: string,
    size: IconSize,
    layoutKey: string,
    positions: GridPositions,
  ) => void
}

export function DesktopGrid({
  items,
  workspace,
  widgets = [],
  folderId,
  arrangeRef,
  onAdd,
  onPositionsChange,
  onWidgetSizeChange,
  onIconSizeChange,
  ...handlers
}: DesktopGridProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const appearance = workspace.settings.icons
  const drag = useShortcutDrag()
  const dragId = drag.activeItem?.id ?? drag.activeId
  const [metrics, setMetrics] = useState({ width: 0, height: 0, measured: false })
  const [target, setTarget] = useState<GridDrop | null>(null)
  const [pageIndex, setPageIndex] = useState(0)
  const [hoverPage, setHoverPage] = useState<number | null>(null)
  const [folderAvailable, setFolderAvailable] = useState(window.innerHeight * 0.88 - 110)
  useDragClickGuard(!!dragId)
  const columnStep = appearance.size + appearance.gapX
  const rowStep = appearance.size + appearance.gapY
  const viewportPaddingY = folderId ? 16 : 8
  const labelHeight = appearance.showName ? appearance.nameSize * 1.1 + 6 : 0
  const columns = getGridTrackCount(metrics.width, appearance.size, appearance.gapX)
  const contentRows = Math.ceil((items.length + 1) / columns)
  const contentHeight = contentRows * rowStep - appearance.gapY + labelHeight + viewportPaddingY * 2
  const folderPaged = contentHeight > folderAvailable
  const folderRows = folderPaged
    ? getGridTrackCount(
        folderAvailable - viewportPaddingY * 2 - 36,
        appearance.size,
        appearance.gapY,
        labelHeight,
      )
    : contentRows
  const rows = folderId
    ? folderRows
    : getGridTrackCount(metrics.height, appearance.size, appearance.gapY, labelHeight)
  const folderHeight = Math.min(
    folderAvailable,
    folderRows * rowStep -
      appearance.gapY +
      labelHeight +
      viewportPaddingY * 2 +
      (folderPaged ? 36 : 0),
  )
  const layoutKey = gridLayoutKey(columns, rows)
  const gridId = folderId ? `folder:${folderId}` : 'desktop'
  const layouts = workspace.gridLayouts[gridId] ?? {}
  const savedProfile = layouts[layoutKey]
  const saved = responsiveGridPositions(layouts, columns, rows, workspace.desktopPositions)
  const order = getDesktopOrder(folderId ? [] : workspace.desktopOrder, [
    ...widgets.map((widget) => widget.id),
    ...items.map((item) => item.id),
  ])
  const entries = [
    ...order.map((id) => {
      const widget = widgets.find((entry) => entry.id === id)
      const item = items.find((entry) => entry.id === id)
      const size = widget
        ? widgetSizePresets.find((entry) => entry.id === workspace.widgetSizes[widget.sizeKey])!
        : folderId
          ? { columns: 1, rows: 1 }
          : getIconSize(id, item!.kind, workspace.iconSizes)
      return { id, columns: size.columns, rows: size.rows }
    }),
    ...(folderId ? [{ id: 'action:add', columns: 1, rows: 1 }] : []),
  ]
  const layout = folderId
    ? compactFolderLayout(
        entries.map((entry) => entry.id),
        columns,
      )
    : arrangeDesktop(entries, saved, columns, undefined, rows)
  const active = layout.find((entry) => entry.id === dragId)
  const preview =
    active && target
      ? folderId
        ? compactFolderLayout(
            [
              ...reorderFolder(
                items.map((item) => item.id),
                active.id,
                target.index,
              ),
              'action:add',
            ],
            columns,
          )
        : arrangeDesktop(
            entries,
            { ...positionsFromLayout(layout), [active.id]: target.position },
            columns,
            active.id,
            rows,
          )
      : layout
  const pageCount = Math.max(1, ...preview.map((entry) => Math.floor(entry.row / rows) + 1))
  const page = Math.min(pageIndex, pageCount - 1)

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const measure = () => {
      const bounds = viewport.getBoundingClientRect()
      const style = getComputedStyle(viewport)
      const width = bounds.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      const height = bounds.height - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
      setMetrics((current) =>
        current.measured && current.width === width && current.height === height
          ? current
          : { width, height, measured: true },
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [folderHeight, appearance.gapX])

  useLayoutEffect(() => {
    if (!folderId || !viewportRef.current) return
    const shell = viewportRef.current.parentElement!
    const panel = shell.closest<HTMLElement>('.folder-panel')!
    const measure = () =>
      setFolderAvailable(
        Math.max(0, window.innerHeight * 0.88 - (panel.offsetHeight - shell.offsetHeight)),
      )
    const observer = new ResizeObserver(measure)
    observer.observe(panel)
    window.addEventListener('resize', measure)
    measure()
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [folderId])

  useEffect(() => {
    if (!arrangeRef) return
    arrangeRef.current = () => {
      const previous = positionsFromLayout(layout)
      onPositionsChange(
        layoutKey,
        positionsFromLayout(arrangeDesktop(entries, {}, columns, undefined, rows)),
        true,
      )
      setPageIndex(0)
      toast('桌面已整理', {
        action: { label: '撤销', onClick: () => onPositionsChange(layoutKey, previous, true) },
      })
    }
    return () => {
      arrangeRef.current = null
    }
  })
  useEffect(() => {
    if (folderId || !metrics.measured || savedProfile || dragId) return
    const frame = requestAnimationFrame(() =>
      onPositionsChange(layoutKey, positionsFromLayout(layout), false),
    )
    return () => cancelAnimationFrame(frame)
  }, [folderId, metrics.measured, savedProfile, dragId, layoutKey, layout, onPositionsChange])

  function turnPage(nextPage: number) {
    setPageIndex(Math.max(0, Math.min(pageCount - 1, nextPage)))
    setTarget(null)
  }
  useEffect(() => {
    if (!dragId || hoverPage === null || hoverPage === page) return
    const timer = setTimeout(() => turnPage(hoverPage), 450)
    return () => clearTimeout(timer)
  })
  useEffect(() => {
    if (!dragId) return
    const keyDown = (event: KeyboardEvent) => {
      if (event.code !== 'PageDown' && event.code !== 'PageUp') return
      event.preventDefault()
      turnPage(page + (event.code === 'PageDown' ? 1 : -1))
    }
    window.addEventListener('keydown', keyDown)
    return () => window.removeEventListener('keydown', keyDown)
  })

  function cellId(column: number, row: number) {
    return `cell:${gridId}:${column}:${row}`
  }
  function gridDrop(column: number, row: number): GridDrop {
    return {
      kind: 'grid',
      folderId: folderId ?? null,
      layoutKey,
      position: { column, row },
      index: Math.min(items.length, row * columns + column),
    }
  }
  const collision: CollisionDetection = (args) => {
    const rect = rootRef.current?.getBoundingClientRect()
    if (!rect || (args.active.data.current?.item?.kind === 'folder' && folderId)) return []
    const point = args.pointerCoordinates ?? {
      x: args.collisionRect.left + args.collisionRect.width / 2,
      y: args.collisionRect.top + args.collisionRect.height / 2,
    }
    if (folderId && (point.y < rect.top || point.y > rect.top + metrics.height)) return []
    const sourceItem = args.active.data.current?.item as DesktopItem | undefined
    if (!folderId && sourceItem?.kind === 'shortcut') {
      const candidate = layout.find((entry) => {
        if (Math.floor(entry.row / rows) !== page || entry.id === sourceItem.id) return false
        const item = items.find((item) => item.id === entry.id)
        if (!item) return false
        const inset = item.kind === 'shortcut' ? 0.25 : 0
        const x = rect.left + entry.column * columnStep
        const y = rect.top + (entry.row % rows) * rowStep
        const width = entry.columns * columnStep - appearance.gapX
        const height = entry.rows * rowStep - appearance.gapY
        return (
          point.x >= x + width * inset &&
          point.x <= x + width * (1 - inset) &&
          point.y >= y + height * inset &&
          point.y <= y + height * (1 - inset)
        )
      })
      if (candidate) {
        if (candidate.id === args.active.data.current?.folderId) {
          const child = args.droppableContainers.find((container) => {
            if (container.data.current?.previewFolderId !== candidate.id) return false
            const rect = args.droppableRects.get(container.id)
            return (
              rect &&
              point.x >= rect.left &&
              point.x <= rect.right &&
              point.y >= rect.top &&
              point.y <= rect.bottom
            )
          })
          if (child) return [{ id: child.id }]
        }
        return [{ id: `target:desktop:${candidate.id}` }]
      }
    }
    const current = active ?? { id: sourceItem?.id ?? '', columns: 1, rows: 1 }
    const location = folderId
      ? {
          column: Math.max(
            0,
            Math.min(
              columns - 1,
              Math.floor((point.x - rect.left + appearance.gapX / 2) / columnStep),
            ),
          ),
          row:
            page * rows +
            Math.max(
              0,
              Math.min(rows - 1, Math.floor((point.y - rect.top + appearance.gapY / 2) / rowStep)),
            ),
        }
      : gridTarget(
          (args.collisionRect.left - rect.left) / columnStep,
          (args.collisionRect.top - rect.top) / rowStep,
          current,
          columns,
          rows,
          page,
        )
    return [{ id: cellId(location.column, location.row) }]
  }
  const surface = useDroppable({
    id: `surface:${gridId}`,
    data: { kind: 'surface', folderId: folderId ?? null, collision },
  })
  function reset() {
    setTarget(null)
    setHoverPage(null)
  }
  useDndMonitor({
    onDragMove: ({ over }) => {
      const drop = (over?.data.current as TargetDragData | undefined)?.drop
      setTarget(drop?.kind === 'grid' && drop.folderId === (folderId ?? null) ? drop : null)
    },
    onDragOver: ({ over }) => {
      const drop = (over?.data.current as TargetDragData | undefined)?.drop
      setTarget(drop?.kind === 'grid' && drop.folderId === (folderId ?? null) ? drop : null)
    },
    onDragCancel: reset,
    onDragEnd: ({ active: dragged, over }) => {
      const drop = (over?.data.current as TargetDragData | undefined)?.drop
      if (!dragged.data.current?.item || dragged.data.current.item.kind === 'folder') {
        if (active && drop?.kind === 'grid' && drop.folderId === (folderId ?? null)) {
          const next = arrangeDesktop(
            entries,
            { ...positionsFromLayout(layout), [active.id]: drop.position },
            columns,
            active.id,
            rows,
          )
          onPositionsChange(layoutKey, positionsFromLayout(next), true)
        }
      }
      reset()
    },
  })
  function position(entry: PlacedEntry, hidden = false): TilePosition {
    return {
      left: entry.column * columnStep,
      top: (entry.row % rows) * rowStep,
      width: entry.columns * columnStep - appearance.gapX,
      height: entry.rows * rowStep - appearance.gapY,
      hidden,
    }
  }
  function resizeWidget(widget: DesktopWidget, size: WidgetSize) {
    const preset = widgetSizePresets.find((entry) => entry.id === size)!
    const resized = entries.map((entry) =>
      entry.id === widget.id ? { ...entry, columns: preset.columns, rows: preset.rows } : entry,
    )
    onWidgetSizeChange?.(
      widget.sizeKey,
      size,
      layoutKey,
      positionsFromLayout(
        arrangeDesktop(resized, positionsFromLayout(layout), columns, widget.id, rows),
      ),
    )
  }
  function resizeIcon(item: DesktopItem, size: IconSize) {
    const preset = iconSizePresets.find((entry) => entry.id === size)!
    const resized = entries.map((entry) =>
      entry.id === item.id ? { ...entry, columns: preset.columns, rows: preset.rows } : entry,
    )
    onIconSizeChange(
      item.id,
      size,
      layoutKey,
      positionsFromLayout(
        arrangeDesktop(resized, positionsFromLayout(layout), columns, item.id, rows),
      ),
    )
  }
  return (
    <div
      className={`flex min-h-0 w-full flex-col ${folderId ? 'shrink' : 'flex-1'}`}
      style={folderId ? { height: folderHeight } : undefined}
    >
      <div
        ref={(node) => {
          viewportRef.current = node
          surface.setNodeRef(node)
        }}
        className="slot-viewport min-h-0 flex-1 overflow-hidden"
        style={{ paddingInline: Math.max(8, appearance.gapX / 2), paddingBlock: viewportPaddingY }}
      >
        <div
          ref={rootRef}
          className="desktop-grid relative mx-auto"
          tabIndex={folderId ? undefined : 0}
          aria-label={folderId ? '分组网站' : '桌面图标与小组件'}
          data-layout-key={layoutKey}
          data-page={page + 1}
          data-sorting={!!dragId}
          data-folder={!!folderId}
          style={{
            width: columns * columnStep - appearance.gapX,
            height: rows * rowStep - appearance.gapY + labelHeight,
            visibility: metrics.measured ? 'visible' : 'hidden',
          }}
        >
          {Array.from({ length: rows }, (_, row) =>
            Array.from({ length: columns }, (_, column) => (
              <CellTarget
                key={`${page}:${column}:${row}`}
                id={cellId(column, page * rows + row)}
                drop={gridDrop(column, page * rows + row)}
                style={{
                  left: column * columnStep,
                  top: row * rowStep,
                  width: appearance.size,
                  height: appearance.size,
                }}
              />
            )),
          )}
          {active && target && !folderId && (
            <motion.div
              className="pointer-events-none absolute rounded-2xl border border-primary/20 bg-primary/8"
              initial={false}
              animate={position({ ...active, ...target.position })}
              transition={{ duration: 0.12 }}
            />
          )}
          {preview.map((entry) => {
            const source = entry.id === dragId && active ? active : entry
            const sourcePosition = position(
              source,
              entry.id !== dragId && Math.floor(entry.row / rows) !== page,
            )
            const widget = widgets.find((widget) => widget.id === entry.id)
            if (widget)
              return (
                <DraggableWidget
                  key={entry.id}
                  widget={widget}
                  position={sourcePosition}
                  size={workspace.widgetSizes[widget.sizeKey]}
                  dragging={!!dragId}
                  onResize={(size) => resizeWidget(widget, size)}
                />
              )
            const item = items.find((item) => item.id === entry.id)
            if (item)
              return (
                <DraggableSite
                  key={entry.id}
                  item={item}
                  position={sourcePosition}
                  workspace={workspace}
                  handlers={handlers}
                  dragging={!!dragId}
                  folderId={folderId}
                  onResize={(size) => resizeIcon(item, size)}
                  dropTarget={{
                    kind: item.kind === 'folder' ? 'folder' : 'shortcut',
                    itemId: item.id,
                    fallback: gridDrop(
                      layout.find((source) => source.id === entry.id)!.column,
                      layout.find((source) => source.id === entry.id)!.row,
                    ),
                  }}
                />
              )
            return folderId ? (
              <FolderAddTile key={entry.id} position={sourcePosition} onAdd={onAdd} />
            ) : null
          })}
        </div>
      </div>
      {(!folderId || pageCount > 1) && (
        <div className="h-9 shrink-0">
          {pageCount > 1 && (
            <nav
              className="grid-pagination flex h-9 shrink-0 items-center justify-center gap-3"
              aria-label={folderId ? '分组分页' : '桌面分页'}
            >
              <button
                type="button"
                className="grid-page-button"
                aria-label="上一页"
                disabled={page === 0}
                onClick={() => turnPage(page - 1)}
                onPointerEnter={() => setHoverPage(page - 1)}
                onPointerLeave={() => setHoverPage(null)}
              >
                <ChevronLeft size={17} />
              </button>
              <span className="min-w-12 text-center text-xs tabular-nums" aria-live="polite">
                {page + 1} / {pageCount}
              </span>
              <button
                type="button"
                className="grid-page-button"
                aria-label="下一页"
                disabled={page + 1 >= pageCount}
                onClick={() => turnPage(page + 1)}
                onPointerEnter={() => setHoverPage(page + 1)}
                onPointerLeave={() => setHoverPage(null)}
              >
                <ChevronRight size={17} />
              </button>
            </nav>
          )}
        </div>
      )}
    </div>
  )
}
