import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
  type RefObject,
} from 'react'
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type KeyboardCoordinateGetter,
  type Modifier,
} from '@dnd-kit/core'
import { CSS, type Transform } from '@dnd-kit/utilities'
import { motion } from 'motion/react'
import { Check, ChevronLeft, ChevronRight, FolderPlus, Maximize2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  arrangeDesktop,
  positionsFromLayout,
  widgetSizePresets,
  type GridPosition,
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

function CellTarget({ column, row, style }: { column: number; row: number; style: CSSProperties }) {
  const { setNodeRef } = useDroppable({
    id: `cell:${column}:${row}`,
    data: { kind: 'cell', column, row },
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
}: {
  item: DesktopItem
  position: TilePosition
  workspace: Workspace
  handlers: TileHandlers
  dragging: boolean
  folderId?: string
  onResize: (size: IconSize) => void
}) {
  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({
    id: item.id,
    data: { item },
  })
  const drop = useDroppable({
    id: `folder:${item.id}`,
    data: { kind: 'folder', folderId: item.id },
    disabled: item.kind !== 'folder' || position.hidden,
  })
  return (
    <div
      ref={(node) => {
        setNodeRef(node)
        drop.setNodeRef(node)
      }}
      data-grid-id={item.id}
      data-dragging={dragging && isDragging}
      style={draggableStyle(position, dragging, isDragging, transform)}
      className="absolute min-w-0"
    >
      <SiteTile
        {...handlers}
        item={item}
        folders={workspace.items.filter((entry) => entry.kind === 'folder')}
        currentFolderId={folderId ?? null}
        openInNewTab={workspace.settings.openInNewTab}
        drag={{ attributes, listeners }}
        isOver={drop.isOver}
        size={getIconSize(item.id, item.kind, workspace.iconSizes).id}
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
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <div
      ref={setNodeRef}
      data-grid-id={widget.id}
      data-dragging={dragging && isDragging}
      className="desktop-widget absolute min-h-0"
      style={draggableStyle(position, dragging, isDragging, transform)}
      onContextMenu={(event) => {
        event.preventDefault()
        setMenuOpen(true)
      }}
    >
      <WidgetDragContext.Provider value={{ attributes, listeners, label: widget.label }}>
        <div className="h-full min-h-0">{widget.content}</div>
      </WidgetDragContext.Provider>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button className="sr-only" aria-label={`${widget.label}尺寸菜单`} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={8}>
          <div className="px-3 pb-1 pt-2 text-[10px] text-muted-foreground">组件尺寸</div>
          {widgetSizePresets.map((preset) => (
            <DropdownMenuItem key={preset.id} onSelect={() => onResize(preset.id)}>
              <Maximize2 />
              {preset.label}
              <span className="ml-auto pl-4 text-[10px] text-muted-foreground">
                {preset.columns} × {preset.rows}
              </span>
              {size === preset.id && <Check className="text-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function ActionTile({
  id,
  position,
  dragging,
  onSettings,
  onAdd,
  onNewFolder,
  folderMode = false,
}: {
  id: string
  position: TilePosition
  dragging: boolean
  onSettings?: () => void
  onAdd: () => void
  onNewFolder?: () => void
  folderMode?: boolean
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging, transform } =
    useDraggable({
      id,
    })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <div
      ref={setNodeRef}
      data-grid-id={id}
      data-dragging={dragging && isDragging}
      className="absolute"
      style={draggableStyle(position, dragging, isDragging, transform)}
    >
      <button
        ref={(node) => {
          buttonRef.current = node
          setActivatorNodeRef(node)
        }}
        {...attributes}
        {...listeners}
        aria-haspopup={id === 'action:add' ? 'menu' : undefined}
        aria-expanded={id === 'action:add' ? menuOpen : undefined}
        onKeyUp={(event) => {
          if (event.code === 'Space') event.preventDefault()
        }}
        onClick={() => {
          if (isDragging) return
          if (id === 'action:settings') onSettings?.()
          else if (folderMode) onAdd()
          else setMenuOpen(true)
        }}
        aria-label={
          id === 'action:settings' ? '打开设置' : folderMode ? '在分组中添加网站' : '添加图标'
        }
        className="site-launch relative block size-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <ActionVisual
          settings={id === 'action:settings'}
          label={id === 'action:settings' ? '设置' : folderMode ? '添加网站' : '添加图标'}
        />
      </button>
      {id === 'action:add' && !folderMode && (
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <span className="pointer-events-none absolute inset-0" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            onCloseAutoFocus={(event) => {
              event.preventDefault()
              buttonRef.current?.focus()
            }}
          >
            <DropdownMenuItem onSelect={onAdd}>
              <Plus />
              添加网站
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onNewFolder}>
              <FolderPlus />
              新建分组
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
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
  onNewFolder?: () => void
  onSettings?: () => void
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
  onNewFolder,
  onSettings,
  onPositionsChange,
  onWidgetSizeChange,
  onIconSizeChange,
  ...handlers
}: DesktopGridProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const appearance = workspace.settings.icons
  const [metrics, setMetrics] = useState({ width: 0, height: 0, measured: false })
  const [dragId, setDragId] = useState<string | null>(null)
  const [target, setTarget] = useState<GridPosition | null>(null)
  const [pageIndex, setPageIndex] = useState(0)
  const [hoverPage, setHoverPage] = useState<number | null>(null)
  const [folderAvailable, setFolderAvailable] = useState(window.innerHeight * 0.88)
  useDragClickGuard(!!dragId)
  const columnStep = appearance.size + appearance.gapX
  const rowStep = appearance.size + appearance.gapY
  const labelHeight = appearance.showName ? appearance.nameSize * 1.1 + 6 : 0
  const columns = getGridTrackCount(metrics.width, appearance.size, appearance.gapX)
  const rows = getGridTrackCount(metrics.height, appearance.size, appearance.gapY, labelHeight)
  const layoutKey = gridLayoutKey(columns, rows)
  const gridId = folderId ? `folder:${folderId}` : 'desktop'
  const layouts = workspace.gridLayouts[gridId] ?? {}
  const savedProfile = layouts[layoutKey]
  const saved = responsiveGridPositions(
    layouts,
    columns,
    rows,
    folderId ? {} : workspace.desktopPositions,
  )

  const order = getDesktopOrder(folderId ? [] : workspace.desktopOrder, [
    ...widgets.map((widget) => widget.id),
    ...items.map((item) => item.id),
  ])
  const entries = [
    ...order.map((id) => {
      const widget = widgets.find((entry) => entry.id === id)
      if (widget) {
        const size = widgetSizePresets.find(
          (entry) => entry.id === workspace.widgetSizes[widget.sizeKey],
        )!
        return { id, columns: size.columns, rows: size.rows }
      }
      const item = items.find((entry) => entry.id === id)!
      const size = getIconSize(id, item.kind, workspace.iconSizes)
      return { id, columns: size.columns, rows: size.rows }
    }),
    ...(!folderId ? [{ id: 'action:settings', columns: 1, rows: 1 }] : []),
    { id: 'action:add', columns: 1, rows: 1 },
  ]
  const layout = arrangeDesktop(entries, saved, columns, undefined, rows)
  const contentLayout = folderId ? arrangeDesktop(entries, {}, columns) : []
  const contentRows = Math.max(1, ...contentLayout.map((entry) => entry.row + entry.rows))
  const folderHeight = Math.min(
    folderAvailable,
    contentRows * rowStep - appearance.gapY + labelHeight + 16 + 36,
  )

  // Finish the initial grid measurement before the dialog's first visible frame.
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
    const observer = new ResizeObserver(() => {
      measure()
      setDragId(null)
      setTarget(null)
      setHoverPage(null)
    })
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [folderHeight, appearance.gapX])

  const active = layout.find((entry) => entry.id === dragId)
  const preview =
    active && target
      ? arrangeDesktop(
          entries,
          { ...positionsFromLayout(layout), [active.id]: target },
          columns,
          active.id,
          rows,
        )
      : layout
  const pageCount = Math.max(1, ...preview.map((entry) => Math.floor(entry.row / rows) + 1))
  const page = Math.min(pageIndex, pageCount - 1)

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

  // Capture each measured grid separately before a resize or a narrow-window edit can replace it.
  useEffect(() => {
    if (!metrics.measured || savedProfile || dragId) return
    // Initial dialog measurements can change synchronously before the first paint.
    const frame = requestAnimationFrame(() =>
      onPositionsChange(layoutKey, positionsFromLayout(layout), false),
    )
    return () => cancelAnimationFrame(frame)
  }, [metrics.measured, savedProfile, dragId, layoutKey, layout, onPositionsChange])

  function turnPage(nextPage: number) {
    const next = Math.max(0, Math.min(pageCount - 1, nextPage))
    if (active) {
      const location = target ?? active
      setTarget(gridTarget(location.column, location.row % rows, active, columns, rows, next))
    }
    setPageIndex(next)
  }
  useEffect(() => {
    if (!dragId || hoverPage === null || hoverPage === page) return
    const timer = setTimeout(() => turnPage(hoverPage), 450)
    return () => clearTimeout(timer)
  })

  const keyboardCoordinates: KeyboardCoordinateGetter = (event, { currentCoordinates }) => {
    if (event.code === 'PageDown' || event.code === 'PageUp') {
      event.preventDefault()
      turnPage(page + (event.code === 'PageDown' ? 1 : -1))
      return
    }
    const delta = {
      ArrowRight: [columnStep, 0],
      ArrowLeft: [-columnStep, 0],
      ArrowDown: [0, rowStep],
      ArrowUp: [0, -rowStep],
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
  const restrictToSlots: Modifier = ({ transform, activeNodeRect }) => {
    const rect = rootRef.current?.getBoundingClientRect()
    if (!rect || !activeNodeRect) return transform
    return {
      ...transform,
      x: Math.max(
        rect.left - activeNodeRect.left,
        Math.min(rect.right - activeNodeRect.right, transform.x),
      ),
      y: Math.max(
        rect.top - activeNodeRect.top,
        Math.min(rect.bottom - labelHeight - activeNodeRect.bottom, transform.y),
      ),
    }
  }
  const collisionDetection: CollisionDetection = (args) => {
    const rect = rootRef.current?.getBoundingClientRect()
    const current = layout.find((entry) => entry.id === args.active.id)
    if (!rect || !current) return []
    if (args.active.data.current?.item?.kind === 'shortcut' && args.pointerCoordinates) {
      const pointer = args.pointerCoordinates
      const folder = layout.find(
        (entry) =>
          Math.floor(entry.row / rows) === page &&
          items.some((item) => item.id === entry.id && item.kind === 'folder') &&
          pointer.x >= rect.left + entry.column * columnStep &&
          pointer.x <= rect.left + (entry.column + entry.columns) * columnStep - appearance.gapX &&
          pointer.y >= rect.top + (entry.row % rows) * rowStep &&
          pointer.y <= rect.top + ((entry.row % rows) + entry.rows) * rowStep - appearance.gapY,
      )
      if (folder) return [{ id: `folder:${folder.id}` }]
    }
    const location = args.pointerCoordinates
      ? gridTarget(
          (args.collisionRect.left - rect.left) / columnStep,
          (args.collisionRect.top - rect.top) / rowStep,
          current,
          columns,
          rows,
          page,
        )
      : (target ?? gridTarget(current.column, current.row % rows, current, columns, rows, page))
    const id = `cell:${location.column}:${location.row}`
    return args.droppableContainers.some((entry) => entry.id === id) ? [{ id }] : []
  }
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
    const next = arrangeDesktop(resized, positionsFromLayout(layout), columns, widget.id, rows)
    onWidgetSizeChange?.(widget.sizeKey, size, layoutKey, positionsFromLayout(next))
  }
  function resizeIcon(item: DesktopItem, size: IconSize) {
    const preset = iconSizePresets.find((entry) => entry.id === size)!
    const resized = entries.map((entry) =>
      entry.id === item.id ? { ...entry, columns: preset.columns, rows: preset.rows } : entry,
    )
    const next = arrangeDesktop(resized, positionsFromLayout(layout), columns, item.id, rows)
    onIconSizeChange(item.id, size, layoutKey, positionsFromLayout(next))
  }
  function finishDrag() {
    setDragId(null)
    setTarget(null)
    setHoverPage(null)
  }
  const draggingItem = items.find((item) => item.id === dragId)
  return (
    <DndContext
      sensors={sensors}
      modifiers={[restrictToSlots]}
      autoScroll={false}
      collisionDetection={collisionDetection}
      onDragStart={(event) => setDragId(String(event.active.id))}
      onDragMove={(event) => {
        const original = layout.find((entry) => entry.id === event.active.id)
        if (event.over?.data.current?.kind === 'folder') setTarget(null)
        else if (original)
          setTarget(
            gridTarget(
              original.column + event.delta.x / columnStep,
              (original.row % rows) + event.delta.y / rowStep,
              original,
              columns,
              rows,
              page,
            ),
          )
      }}
      onDragCancel={finishDrag}
      onDragEnd={(event) => {
        if (event.over?.data.current?.kind === 'folder' && draggingItem?.kind === 'shortcut')
          handlers.onMove(draggingItem.id, event.over.data.current.folderId)
        else if (event.over && active) {
          const data = event.over.data.current
          if (data?.kind === 'cell') {
            const next = arrangeDesktop(
              entries,
              {
                ...positionsFromLayout(layout),
                [active.id]: { column: data.column, row: data.row },
              },
              columns,
              active.id,
              rows,
            )
            onPositionsChange(layoutKey, positionsFromLayout(next), true)
          }
        }
        finishDrag()
      }}
      accessibility={{
        screenReaderInstructions: {
          draggable: '按空格抓起，方向键移动，PageUp 或 PageDown 翻页，空格放下，Escape 取消。',
        },
      }}
    >
      <div
        className={`flex min-h-0 w-full flex-col ${folderId ? 'shrink' : 'flex-1'}`}
        style={folderId ? { height: folderHeight } : undefined}
      >
        <div
          ref={viewportRef}
          className="slot-viewport min-h-0 flex-1 overflow-hidden py-2"
          style={{ paddingInline: Math.max(8, appearance.gapX / 2) }}
        >
          <div
            ref={rootRef}
            className="desktop-grid relative mx-auto"
            aria-label={folderId ? '分组网站' : '桌面图标与小组件'}
            data-layout-key={layoutKey}
            data-page={page + 1}
            data-sorting={!!dragId}
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
                  column={column}
                  row={page * rows + row}
                  style={{
                    left: column * columnStep,
                    top: row * rowStep,
                    width: appearance.size,
                    height: appearance.size,
                  }}
                />
              )),
            )}
            {active && target && (
              <motion.div
                className="pointer-events-none absolute rounded-2xl border border-primary/20 bg-primary/8"
                animate={position({ ...active, ...target })}
                transition={{ duration: 0.12 }}
              />
            )}
            {preview.map((entry) => {
              const source = entry.id === dragId && active ? active : entry
              const hidden = entry.id !== dragId && Math.floor(entry.row / rows) !== page
              const sourcePosition = position(source, hidden)
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
                  />
                )
              return (
                <ActionTile
                  key={entry.id}
                  id={entry.id}
                  position={sourcePosition}
                  dragging={!!dragId}
                  folderMode={!!folderId}
                  onSettings={onSettings}
                  onAdd={onAdd}
                  onNewFolder={onNewFolder}
                />
              )
            })}
          </div>
        </div>
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
      </div>
    </DndContext>
  )
}
