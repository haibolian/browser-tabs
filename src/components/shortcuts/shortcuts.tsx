import { useState, type RefObject } from 'react'
import { motion } from 'motion/react'
import { FolderClosed, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  moveShortcut,
  removeShortcut,
  ungroupFolder,
  type DesktopItem,
  type Folder,
  type Shortcut,
  type Workspace,
  type UpdateWorkspace,
} from '@/lib/workspace'
import { folderAppearanceStyle } from '@/lib/icon-appearance'
import type { GridPositions } from '@/lib/desktop-layout'
import { IconGrid, type DesktopWidget } from './icon-grid'
import { ShortcutEditor } from './shortcut-editor'
import { FolderEditor } from './folder-editor'

type EditorState =
  | { kind: 'shortcut'; item: Shortcut | null; parentId: string | null }
  | { kind: 'folder'; item: Folder | null }
  | null

export function Shortcuts({
  workspace,
  update,
  widgets,
  onSettings,
  arrangeRef,
}: {
  workspace: Workspace
  update: UpdateWorkspace
  widgets: DesktopWidget[]
  onSettings: () => void
  arrangeRef: RefObject<(() => void) | null>
}) {
  const [folderId, setFolderId] = useState<string | null>(null)
  const [folderOpen, setFolderOpen] = useState(false)
  const [editor, setEditor] = useState<EditorState>(null)
  const folder = workspace.items.find(
    (item): item is Folder => item.id === folderId && item.kind === 'folder',
  )

  function move(id: string, target: string | null) {
    update((state) => ({ ...state, items: moveShortcut(state.items, id, target) }))
    toast(target ? '已收进分组' : '已移回桌面')
  }
  function edit(item: DesktopItem) {
    const parent = workspace.items.find(
      (entry) => entry.kind === 'folder' && entry.items.some((child) => child.id === item.id),
    )
    setEditor(
      item.kind === 'folder'
        ? { kind: 'folder', item }
        : { kind: 'shortcut', item, parentId: parent?.id ?? null },
    )
  }
  function remove(item: DesktopItem) {
    update((state) => ({ ...state, items: removeShortcut(state.items, item.id) }))
    toast(
      item.kind === 'folder'
        ? `「${item.title}」及其中 ${item.items.length} 个网站已删除`
        : `「${item.title}」已删除`,
      {
        action: {
          label: '撤销',
          onClick: () => update((state) => ({ ...state, items: [...state.items, item] })),
        },
      },
    )
  }
  function ungroup(id: string) {
    update((state) => ({ ...state, items: ungroupFolder(state.items, id) }))
    setFolderOpen(false)
    toast('分组已解散，网站已移回桌面')
  }
  const handlers = {
    workspace,
    onMove: move,
    onEdit: edit,
    onDelete: remove,
    onUngroup: ungroup,
    onOpenFolder: (id: string) => {
      setFolderId(id)
      setFolderOpen(true)
    },
  }

  function saveLayout(gridId: string, key: string, positions: GridPositions, moved = false) {
    update((state) => {
      if (!moved && state.gridLayouts[gridId]?.[key]) return state
      const next = withLayout(state, gridId, key, positions)
      if (!moved || gridId === 'desktop') return next
      return {
        ...next,
        items: next.items.map((item) =>
          item.kind === 'folder' && `folder:${item.id}` === gridId
            ? {
                ...item,
                items: [...item.items].sort(
                  (a, b) =>
                    (positions[a.id]?.row ?? 0) - (positions[b.id]?.row ?? 0) ||
                    (positions[a.id]?.column ?? 0) - (positions[b.id]?.column ?? 0),
                ),
              }
            : item,
        ),
      }
    })
  }

  function withLayout(
    state: Workspace,
    gridId: string,
    key: string,
    positions: GridPositions,
  ): Workspace {
    return {
      ...state,
      gridLayouts: {
        ...state.gridLayouts,
        [gridId]: { ...state.gridLayouts[gridId], [key]: positions },
      },
    }
  }

  return (
    <motion.section
      id="shortcuts"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25, duration: 0.5 }}
      className="mx-auto flex min-h-0 w-full flex-1 flex-col"
      style={{ maxWidth: workspace.settings.icons.maxWidth }}
      aria-label="网站与小组件"
    >
      <IconGrid
        {...handlers}
        items={workspace.items}
        widgets={widgets}
        arrangeRef={arrangeRef}
        onSettings={onSettings}
        onPositionsChange={(key, positions, moved) => saveLayout('desktop', key, positions, moved)}
        onWidgetSizeChange={(key, size, layoutKey, positions) =>
          update((state) => ({
            ...withLayout(state, 'desktop', layoutKey, positions),
            widgetSizes: { ...state.widgetSizes, [key]: size },
          }))
        }
        onIconSizeChange={(id, size, layoutKey, positions) =>
          update((state) => ({
            ...withLayout(state, 'desktop', layoutKey, positions),
            iconSizes: { ...state.iconSizes, [id]: size },
          }))
        }
        onAdd={() => setEditor({ kind: 'shortcut', item: null, parentId: null })}
        onNewFolder={() => setEditor({ kind: 'folder', item: null })}
      />
      <Dialog open={folderOpen && !!folder} onOpenChange={setFolderOpen}>
        <DialogContent
          style={folderAppearanceStyle(workspace.settings.icons)}
          className="folder-panel max-w-[820px] overflow-hidden bg-surface/95 text-foreground"
        >
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2.5">
              <FolderClosed size={22} style={{ color: folder?.color }} />
              {folder?.title}
            </DialogTitle>
            <DialogDescription>
              {folder?.items.length ?? 0} 个网站 · 把喜欢的放在一起
            </DialogDescription>
          </DialogHeader>
          {folder && (
            <IconGrid
              {...handlers}
              items={folder.items}
              folderId={folder.id}
              onPositionsChange={(key, positions, moved) =>
                saveLayout(`folder:${folder.id}`, key, positions, moved)
              }
              onAdd={() => setEditor({ kind: 'shortcut', item: null, parentId: folder.id })}
              onIconSizeChange={(id, size, key, positions) =>
                update((state) => ({
                  ...withLayout(state, `folder:${folder.id}`, key, positions),
                  iconSizes: { ...state.iconSizes, [id]: size },
                }))
              }
            />
          )}
          {folder && (
            <div className="mt-3 flex shrink-0 items-center justify-between border-t border-border/60 pt-3">
              <Button variant="ghost" size="sm" onClick={() => edit(folder)}>
                <Pencil className="!size-3" />
                编辑分组
              </Button>
              <span className="text-[10px] text-muted-foreground">右键图标可编辑或移出</span>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {editor?.kind === 'shortcut' && (
        <ShortcutEditor
          key={editor.item?.id ?? `new-${editor.parentId}`}
          item={editor.item}
          initialParentId={editor.parentId}
          workspace={workspace}
          onClose={() => setEditor(null)}
          update={update}
        />
      )}
      {editor?.kind === 'folder' && (
        <FolderEditor
          key={editor.item?.id ?? 'new-folder'}
          item={editor.item}
          onClose={() => setEditor(null)}
          update={update}
        />
      )}
    </motion.section>
  )
}
