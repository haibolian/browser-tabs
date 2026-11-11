import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type KeyboardCoordinateGetter,
} from '@dnd-kit/core'
import { motion } from 'motion/react'
import { Check, FolderPlus, Maximize2, Plus, Settings2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
} from '@/lib/desktop-layout'
import { getDesktopOrder, type DesktopItem, type Workspace } from '@/lib/workspace'
import { ItemVisual, SiteTile, type TileHandlers } from './site-tile'
import { WidgetDragContext } from '@/components/widgets/widget-drag-context'

type TilePosition = { left: number; top: number; width: number; height: number }

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
      className="pointer-events-none absolute rounded-xl"
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
  onResize,
}: {
  item: DesktopItem
  position: TilePosition
  workspace: Workspace
  handlers: TileHandlers
  dragging: boolean
  onResize: (size: IconSize) => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: { item },
  })
  const drop = useDroppable({
    id: `folder:${item.id}`,
    data: { kind: 'folder', folderId: item.id },
    disabled: item.kind !== 'folder',
  })
  return (
    <motion.div
      ref={(node) => {
        setNodeRef(node)
        drop.setNodeRef(node)
      }}
      data-grid-id={item.id}
      initial={false}
      animate={position}
      transition={dragging ? { duration: 0.15 } : { type: 'spring', stiffness: 320, damping: 32 }}
      className="absolute min-w-0"
    >
      <SiteTile
        {...handlers}
        item={item}
        folders={workspace.items.filter((entry) => entry.kind === 'folder')}
        currentFolderId={null}
        openInNewTab={workspace.settings.openInNewTab}
        drag={{ attributes, listeners }}
        isDragging={isDragging}
        isOver={drop.isOver}
        size={getIconSize(item.id, item.kind, workspace.iconSizes).id}
        onResize={onResize}
        appearance={workspace.settings.icons}
      />
    </motion.div>
  )
}

function DraggableWidget({
  widget,
  position,
  size,
  onResize,
}: {
  widget: DesktopWidget
  position: TilePosition
  size: WidgetSize
  onResize: (size: WidgetSize) => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: widget.id })
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <motion.div
      ref={setNodeRef}
      data-grid-id={widget.id}
      initial={false}
      animate={position}
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      className="desktop-widget absolute min-h-0"
      style={{ opacity: isDragging ? 0.25 : 1 }}
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
          <DropdownMenuSeparator />
          <div className="px-3 py-1.5 text-[10px] text-muted-foreground">
            拖动卡片头部可移动位置
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </motion.div>
  )
}

function ActionTile({
  id,
  position,
  children,
}: {
  id: string
  position: TilePosition
  children: ReactNode
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id })
  return (
    <motion.div
      ref={setNodeRef}
      data-grid-id={id}
      animate={position}
      initial={false}
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      className="absolute"
      style={{ opacity: isDragging ? 0.3 : 1 }}
      {...attributes}
      {...listeners}
    >
      {children}
    </motion.div>
  )
}

export type DesktopGridProps = TileHandlers & {
  items: DesktopItem[]
  workspace: Workspace
  widgets: DesktopWidget[]
  onAdd: () => void
  onNewFolder: () => void
  onSettings: () => void
  onPositionsChange: (positions: Record<string, GridPosition>) => void
  onWidgetSizeChange: (
    key: keyof Workspace['widgetSizes'],
    size: WidgetSize,
    positions: Record<string, GridPosition>,
  ) => void
  onIconSizeChange: (id: string, size: IconSize, positions: Record<string, GridPosition>) => void
}

export function DesktopGrid({
  items,
  workspace,
  widgets,
  onAdd,
  onNewFolder,
  onSettings,
  onPositionsChange,
  onWidgetSizeChange,
  onIconSizeChange,
  ...handlers
}: DesktopGridProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const appearance = workspace.settings.icons
  const [metrics, setMetrics] = useState({
    width: Math.min(window.innerWidth - 80, appearance.maxWidth),
  })
  const [dragId, setDragId] = useState<string | null>(null)
  const [target, setTarget] = useState<GridPosition | null>(null)
  const columns = Math.max(
    1,
    Math.floor((metrics.width + appearance.gapX) / (appearance.size + appearance.gapX)),
  )
  const rowHeight = appearance.size
  const rowGap = appearance.gapY
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width
      setMetrics({ width })
    })
    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])
  const cellWidth = appearance.size
  const columnStep = cellWidth + appearance.gapX
  const rowStep = rowHeight + rowGap
  const order = getDesktopOrder(workspace.desktopOrder, [
    ...widgets.map((widget) => widget.id),
    ...items.map((item) => item.id),
  ])
  const entries = [
    ...order.map((id) => {
      const widget = widgets.find((entry) => entry.id === id)
      const preset = widget
        ? widgetSizePresets.find((entry) => entry.id === workspace.widgetSizes[widget.sizeKey])!
        : null
      const item = items.find((entry) => entry.id === id)
      const iconSize = item ? getIconSize(id, item.kind, workspace.iconSizes) : null
      return {
        id,
        columns: preset?.columns ?? iconSize?.columns ?? 1,
        rows: preset?.rows ?? iconSize?.rows ?? 1,
      }
    }),
    { id: 'action:settings', columns: 1, rows: 1 },
    { id: 'action:add', columns: 1, rows: 1 },
  ]
  const layout = arrangeDesktop(entries, workspace.desktopPositions, columns)
  const active = layout.find((entry) => entry.id === dragId)
  const preview =
    active && target
      ? arrangeDesktop(
          entries,
          { ...positionsFromLayout(layout), [active.id]: target },
          columns,
          active.id,
        )
      : layout
  const rowCount = Math.max(
    2,
    ...preview.map((entry) => entry.row + entry.rows),
    target ? target.row + (active?.rows ?? 1) + 1 : 0,
  )
  const keyboardCoordinates: KeyboardCoordinateGetter = (event, { currentCoordinates }) => {
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
    useSensor(KeyboardSensor, { coordinateGetter: keyboardCoordinates }),
  )
  const collisionDetection: CollisionDetection = (args) => {
    const rect = rootRef.current?.getBoundingClientRect()
    const current = layout.find((entry) => entry.id === args.active.id)
    if (!rect || !current) return []
    if (args.active.data.current?.item?.kind === 'shortcut' && args.pointerCoordinates) {
      const pointer = args.pointerCoordinates
      const folder = layout.find(
        (entry) =>
          items.some((item) => item.id === entry.id && item.kind === 'folder') &&
          pointer.x >= rect.left + entry.column * columnStep &&
          pointer.x <=
            rect.left + entry.column * columnStep + entry.columns * columnStep - appearance.gapX &&
          pointer.y >= rect.top + entry.row * rowStep &&
          pointer.y <= rect.top + entry.row * rowStep + entry.rows * rowStep - rowGap,
      )
      if (folder) return [{ id: `folder:${folder.id}` }]
    }
    const column = Math.max(
      0,
      Math.min(
        columns - current.columns,
        Math.round((args.collisionRect.left - rect.left) / columnStep),
      ),
    )
    const row = Math.max(0, Math.round((args.collisionRect.top - rect.top) / rowStep))
    const id = `cell:${column}:${row}`
    return args.droppableContainers.some((entry) => entry.id === id) ? [{ id }] : []
  }
  function position(entry: PlacedEntry): TilePosition {
    return {
      left: entry.column * columnStep,
      top: entry.row * rowStep,
      width: entry.columns * columnStep - appearance.gapX,
      height: entry.rows * rowStep - rowGap,
    }
  }
  function resize(widget: DesktopWidget, size: WidgetSize) {
    const preset = widgetSizePresets.find((entry) => entry.id === size)!
    const resized = entries.map((entry) =>
      entry.id === widget.id ? { ...entry, columns: preset.columns, rows: preset.rows } : entry,
    )
    const next = arrangeDesktop(resized, positionsFromLayout(layout), columns, widget.id)
    onWidgetSizeChange(widget.sizeKey, size, positionsFromLayout(next))
  }
  function resizeIcon(item: DesktopItem, size: IconSize) {
    const preset = iconSizePresets.find((entry) => entry.id === size)!
    const resized = entries.map((entry) =>
      entry.id === item.id ? { ...entry, columns: preset.columns, rows: preset.rows } : entry,
    )
    const next = arrangeDesktop(resized, positionsFromLayout(layout), columns, item.id)
    onIconSizeChange(item.id, size, positionsFromLayout(next))
  }
  const draggingItem = items.find((item) => item.id === dragId)
  const draggingWidget = widgets.find((widget) => widget.id === dragId)
  const actionClass =
    'site-launch relative block size-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary/40'
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={(event) => setDragId(String(event.active.id))}
      onDragMove={(event) => {
        const original = layout.find((entry) => entry.id === event.active.id)
        if (event.over?.data.current?.kind === 'folder') setTarget(null)
        else if (original)
          setTarget({
            column: Math.max(
              0,
              Math.min(
                columns - original.columns,
                Math.round(original.column + event.delta.x / columnStep),
              ),
            ),
            row: Math.max(0, Math.round(original.row + event.delta.y / rowStep)),
          })
      }}
      onDragCancel={() => {
        setDragId(null)
        setTarget(null)
      }}
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
            )
            onPositionsChange(positionsFromLayout(next))
          }
        }
        setDragId(null)
        setTarget(null)
      }}
      accessibility={{
        screenReaderInstructions: {
          draggable: '按空格抓起，使用方向键移动到任意网格，按空格放下，Escape 取消。',
        },
      }}
    >
      <div ref={containerRef} className="w-full">
        <div
          ref={rootRef}
          className="desktop-grid relative mx-auto"
          aria-label="桌面图标与小组件"
          style={{
            width: columns * columnStep - appearance.gapX,
            height:
              rowCount * rowStep -
              rowGap +
              (appearance.showName ? appearance.nameSize * 1.1 + 6 : 0),
          }}
        >
          {Array.from({ length: rowCount + 1 }, (_, row) =>
            Array.from({ length: columns }, (_, column) => (
              <CellTarget
                key={`${column}:${row}`}
                column={column}
                row={row}
                style={{
                  left: column * columnStep,
                  top: row * rowStep,
                  width: cellWidth,
                  height: rowHeight,
                }}
              />
            )),
          )}
          {dragId && active && target && (
            <motion.div
              className="pointer-events-none absolute rounded-2xl border border-primary/20 bg-primary/8"
              animate={position({ ...active, ...target })}
              transition={{ duration: 0.12 }}
            />
          )}
          {preview.map((entry) => {
            const widget = widgets.find((widget) => widget.id === entry.id)
            if (widget)
              return (
                <DraggableWidget
                  key={entry.id}
                  widget={widget}
                  position={position(entry)}
                  size={workspace.widgetSizes[widget.sizeKey]}
                  onResize={(size) => resize(widget, size)}
                />
              )
            const item = items.find((item) => item.id === entry.id)
            if (item)
              return (
                <DraggableSite
                  key={entry.id}
                  item={item}
                  position={position(entry)}
                  workspace={workspace}
                  handlers={handlers}
                  dragging={!!dragId}
                  onResize={(size) => resizeIcon(item, size)}
                />
              )
            return (
              <ActionTile key={entry.id} id={entry.id} position={position(entry)}>
                {entry.id === 'action:settings' ? (
                  <button onClick={onSettings} aria-label="打开设置" className={actionClass}>
                    <span className="action-icon flex items-center justify-center border border-surface-border/65 bg-shortcut/90 text-primary/60 shadow-sm">
                      <Settings2 size={25} strokeWidth={1.6} />
                    </span>
                    <span className="tile-label action-label">设置</span>
                  </button>
                ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className={actionClass} aria-label="添加图标">
                        <span className="action-icon flex items-center justify-center border border-dashed border-primary/20 bg-shortcut/40 text-primary/50">
                          <Plus size={25} strokeWidth={1.5} />
                        </span>
                        <span className="tile-label action-label">添加图标</span>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
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
              </ActionTile>
            )
          })}
        </div>
      </div>
      <DragOverlay dropAnimation={{ duration: 240, easing: 'cubic-bezier(.2,.8,.2,1)' }}>
        {draggingItem ? (
          <ItemVisual
            item={draggingItem}
            size={getIconSize(draggingItem.id, draggingItem.kind, workspace.iconSizes).id}
            width={active ? position(active).width : undefined}
            height={active ? position(active).height : undefined}
            overlay
            appearance={appearance}
          />
        ) : draggingWidget && active ? (
          <div
            className="overflow-hidden rounded-[17px] bg-surface shadow-2xl"
            style={{ width: position(active).width, height: position(active).height }}
          >
            {draggingWidget.content}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
