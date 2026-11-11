import { useState } from 'react'
import type { useDraggable } from '@dnd-kit/core'
import {
  FolderClosed,
  FolderInput,
  LayoutGrid,
  MoreHorizontal,
  Pencil,
  Trash2,
  Ungroup,
  Check,
  ExternalLink,
  Maximize2,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
}: {
  item: DesktopItem
  overlay?: boolean
  size?: IconSize
  width?: number
  height?: number
  appearance: IconAppearance
  folderInteraction?: FolderInteraction
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
        <SiteIcon site={item} className="site-icon-fill" />
      )}
      {item.kind === 'folder' && folderInteraction ? (
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
      )}
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
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const className =
    'site-launch flex size-full flex-col items-center rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary/50'
  return (
    <div
      style={{
        opacity: isDragging ? 0.25 : 1,
      }}
      className={cn(
        'site-tile group relative flex size-full min-w-0 flex-col items-center rounded-2xl',
        isOver && item.kind === 'folder' && 'drop-folder',
      )}
      onContextMenu={(event) => {
        event.preventDefault()
        setMenuOpen(true)
      }}
    >
      {item.kind === 'folder' ? (
        <ItemVisual
          item={item}
          size={size}
          appearance={appearance}
          folderInteraction={{ open: () => onOpenFolder(item.id), openInNewTab, drag }}
        />
      ) : (
        <a
          {...drag?.attributes}
          {...drag?.listeners}
          role="link"
          href={item.url}
          target={openInNewTab ? '_blank' : '_self'}
          rel="noreferrer"
          className={className}
          aria-label={`打开网站：${item.title}`}
        >
          <ItemVisual item={item} size={size} appearance={appearance} />
        </a>
      )}
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              'absolute -right-1 -top-2 flex size-5 items-center justify-center rounded-full bg-popover/95 text-muted-foreground opacity-0 shadow-sm transition-all hover:text-primary focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100',
              menuOpen && 'opacity-100',
            )}
            aria-label={`${item.title}的更多操作`}
          >
            <MoreHorizontal size={12} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {item.kind === 'shortcut' && (
            <DropdownMenuItem asChild>
              <a href={item.url} target="_blank" rel="noreferrer">
                <ExternalLink />
                在新标签页打开
              </a>
            </DropdownMenuItem>
          )}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Maximize2 />
              布局
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {iconSizePresets.map((preset) => (
                <DropdownMenuItem key={preset.id} onSelect={() => onResize(preset.id)}>
                  <span className="min-w-12">
                    {preset.columns} × {preset.rows}
                  </span>
                  {preset.id === size && <Check className="ml-auto" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => onEdit(item)}>
            <Pencil />
            {item.kind === 'folder' ? '编辑分组' : '编辑图标'}
          </DropdownMenuItem>
          {item.kind === 'shortcut' && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <FolderInput />
                移动到
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {currentFolderId && (
                  <DropdownMenuItem onSelect={() => onMove(item.id, null)}>
                    <LayoutGrid />
                    桌面
                  </DropdownMenuItem>
                )}
                {folders
                  .filter((folder) => folder.id !== currentFolderId)
                  .map((folder) => (
                    <DropdownMenuItem key={folder.id} onSelect={() => onMove(item.id, folder.id)}>
                      <FolderClosed />
                      {folder.title}
                    </DropdownMenuItem>
                  ))}
                {!currentFolderId && !folders.length && (
                  <DropdownMenuItem disabled>请先新建一个分组</DropdownMenuItem>
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
          {item.kind === 'folder' && (
            <DropdownMenuItem onSelect={() => onUngroup(item.id)}>
              <Ungroup />
              解散分组，保留网站
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:bg-destructive/5"
            onSelect={() => onDelete(item)}
          >
            <Trash2 />
            {item.kind === 'folder' ? '删除分组及网站' : '删除网站'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
