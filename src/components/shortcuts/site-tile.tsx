import type { useDraggable } from '@dnd-kit/core'
import {
  FolderClosed,
  FolderInput,
  LayoutGrid,
  Pencil,
  Trash2,
  Ungroup,
  Check,
  ExternalLink,
  Maximize2,
} from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import type { DesktopItem, Folder } from '@/lib/workspace'
import { cn } from '@/lib/utils'
import { SiteIcon } from './site-icon'
import { iconSizePresets, type IconSize } from '@/lib/desktop-layout'
import type { IconAppearance } from '@/lib/icon-appearance'
import { FolderPreview, type FolderInteraction } from './folder-preview'

export function ItemVisual({
  item,
  overlay = false,
  size = '1x1',
  width,
  height,
  appearance,
  folderInteraction,
  showLabel = true,
  mini = false,
}: {
  item: DesktopItem
  overlay?: boolean
  size?: IconSize
  width?: number
  height?: number
  appearance: IconAppearance
  folderInteraction?: FolderInteraction
  showLabel?: boolean
  mini?: boolean
}) {
  return (
    <span
      className={cn('site-visual relative block size-full', overlay && 'scale-105')}
      style={{ width, height }}
    >
      {item.kind === 'folder' ? (
        <FolderPreview
          folder={item}
          size={size}
          appearance={appearance}
          interaction={folderInteraction}
        />
      ) : (
        <SiteIcon site={item} mini={mini} className="site-icon-fill" />
      )}
      {showLabel &&
        (item.kind === 'folder' && folderInteraction ? (
          <button
            type="button"
            tabIndex={-1}
            {...folderInteraction.drag?.listeners}
            className="tile-label site-label"
            aria-label={`展开分组：${item.title}`}
            onClick={folderInteraction.open}
          >
            {item.title}
          </button>
        ) : (
          <span className="tile-label site-label">{item.title}</span>
        ))}
    </span>
  )
}

export type TileHandlers = {
  onOpenFolder: (id: string) => void
  onEdit: (item: DesktopItem) => void
  onDelete: (item: DesktopItem) => void
  onMove: (id: string, folderId: string | null) => void
  onUngroup: (id: string) => void
}

export function SiteTile({
  item,
  folders,
  currentFolderId,
  openInNewTab,
  onOpenFolder,
  onEdit,
  onDelete,
  onMove,
  onUngroup,
  drag,
  isOver = false,
  isDragging = false,
  size,
  onResize,
  appearance,
  compact = false,
  mini = false,
}: TileHandlers & {
  item: DesktopItem
  folders: Folder[]
  currentFolderId: string | null
  openInNewTab: boolean
  drag?: Pick<ReturnType<typeof useDraggable>, 'attributes' | 'listeners'>
  isOver?: boolean
  isDragging?: boolean
  size: IconSize
  onResize: (size: IconSize) => void
  appearance: IconAppearance
  compact?: boolean
  mini?: boolean
}) {
  const className =
    'site-launch flex size-full flex-col items-center rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary/50'
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          style={{
            opacity: isDragging ? 0.25 : 1,
          }}
          className={cn(
            'site-tile group relative flex size-full min-w-0 flex-col items-center rounded-2xl',
            isOver && 'drop-folder',
          )}
        >
          {item.kind === 'folder' ? (
            <ItemVisual
              item={item}
              size={size}
              appearance={appearance}
              folderInteraction={{
                open: () => onOpenFolder(item.id),
                openInNewTab,
                drag,
                folders,
                handlers: { onOpenFolder, onEdit, onDelete, onMove, onUngroup },
              }}
            />
          ) : (
            <a
              {...drag?.attributes}
              {...drag?.listeners}
              role="link"
              href={item.url}
              target={openInNewTab ? '_blank' : '_self'}
              rel="noreferrer"
              draggable={false}
              className={className}
              aria-label={`打开网站：${item.title}`}
            >
              <ItemVisual item={item} appearance={appearance} showLabel={!compact} mini={mini} />
            </a>
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent aria-label={`${item.title}菜单`}>
        {item.kind === 'shortcut' && (
          <ContextMenuItem asChild>
            <a href={item.url} target="_blank" rel="noreferrer">
              <ExternalLink />
              在新标签页打开
            </a>
          </ContextMenuItem>
        )}
        {!currentFolderId && (
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <Maximize2 />
              布局
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              {iconSizePresets.map((preset) => (
                <ContextMenuItem key={preset.id} onAction={() => onResize(preset.id)}>
                  <span className="min-w-12">
                    {preset.columns} × {preset.rows}
                  </span>
                  {preset.id === size && <Check className="ml-auto" />}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem onAction={() => onEdit(item)}>
          <Pencil />
          {item.kind === 'folder' ? '编辑分组' : '编辑图标'}
        </ContextMenuItem>
        {item.kind === 'shortcut' && (
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <FolderInput />
              移动到
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              {currentFolderId && (
                <ContextMenuItem onAction={() => onMove(item.id, null)}>
                  <LayoutGrid />
                  桌面
                </ContextMenuItem>
              )}
              {folders
                .filter((folder) => folder.id !== currentFolderId)
                .map((folder) => (
                  <ContextMenuItem key={folder.id} onAction={() => onMove(item.id, folder.id)}>
                    <FolderClosed />
                    {folder.title}
                  </ContextMenuItem>
                ))}
              {!currentFolderId && !folders.length && (
                <ContextMenuItem disabled>请先新建一个分组</ContextMenuItem>
              )}
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}
        {item.kind === 'folder' && (
          <ContextMenuItem onAction={() => onUngroup(item.id)}>
            <Ungroup />
            解散分组，保留网站
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem
          className="text-destructive focus:bg-destructive/5"
          onAction={() => onDelete(item)}
        >
          <Trash2 />
          {item.kind === 'folder' ? '删除分组及网站' : '删除网站'}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
