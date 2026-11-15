import type { ReactElement } from 'react'
import { FolderPlus, Plus, Settings2 } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'

export function DesktopMenu({
  children,
  onAdd,
  onNewFolder,
  onSettings,
}: {
  children: ReactElement
  onAdd: () => void
  onNewFolder: () => void
  onSettings: () => void
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger
        asChild
        onContextMenuCapture={(event) => {
          if (
            (event.target as Element).closest('input, textarea, select, [contenteditable="true"]')
          )
            event.stopPropagation()
        }}
        onContextMenu={(event) => {
          if (
            (event.target as Element).closest(
              '[data-grid-id], a, button, [role="dialog"], [role="menu"]',
            )
          )
            event.preventDefault()
        }}
      >
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent aria-label="桌面菜单">
        <ContextMenuItem onAction={onAdd}>
          <Plus />
          添加图标
        </ContextMenuItem>
        <ContextMenuItem onAction={onNewFolder}>
          <FolderPlus />
          新建分组
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onAction={onSettings}>
          <Settings2 />
          设置
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
