import { useState } from 'react'
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
import { iconAppearanceStyle } from '@/lib/icon-appearance'
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
}: {
  workspace: Workspace
  update: UpdateWorkspace
  widgets: DesktopWidget[]
  onSettings: () => void
}) {
  const [folderId, setFolderId] = useState<string | null>(null)
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
    setFolderId(null)
    toast('分组已解散，网站已移回桌面')
  }
  const handlers = {
    workspace,
    onMove: move,
    onEdit: edit,
    onDelete: remove,
    onUngroup: ungroup,
    onOpenFolder: setFolderId,
  }

  return (
    <motion.section
      id="shortcuts"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25, duration: 0.5 }}
      className="mx-auto w-full scroll-mt-8"
      style={{ maxWidth: workspace.settings.icons.maxWidth }}
      aria-label="网站与小组件"
    >
      <IconGrid
        {...handlers}
        items={workspace.items}
        widgets={widgets}
        onSettings={onSettings}
        onPositionsChange={(positions) =>
          update((state) => ({
            ...state,
            desktopPositions: { ...state.desktopPositions, ...positions },
          }))
        }
        onWidgetSizeChange={(key, size, positions) =>
          update((state) => ({
            ...state,
            widgetSizes: { ...state.widgetSizes, [key]: size },
            desktopPositions: { ...state.desktopPositions, ...positions },
          }))
        }
        onIconSizeChange={(id, size, positions) =>
          update((state) => ({
            ...state,
            iconSizes: { ...state.iconSizes, [id]: size },
            desktopPositions: { ...state.desktopPositions, ...positions },
          }))
        }
        onAdd={() => setEditor({ kind: 'shortcut', item: null, parentId: null })}
        onNewFolder={() => setEditor({ kind: 'folder', item: null })}
      />
      <Dialog
        open={!!folder}
        onOpenChange={(open) => {
          if (!open) setFolderId(null)
        }}
      >
        <DialogContent
          style={iconAppearanceStyle(workspace.settings.icons)}
          className="folder-panel max-w-[820px] overflow-y-auto bg-surface/90"
        >
          <DialogHeader>
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
              onReorder={(items) =>
                update((state) => ({
                  ...state,
                  items: state.items.map((item) =>
                    item.id === folder.id && item.kind === 'folder'
                      ? { ...item, items: items as Shortcut[] }
                      : item,
                  ),
                }))
              }
              onAdd={() => setEditor({ kind: 'shortcut', item: null, parentId: folder.id })}
              onResizeIcon={(id, size) =>
                update((state) => ({ ...state, iconSizes: { ...state.iconSizes, [id]: size } }))
              }
            />
          )}
          {folder && (
            <div className="mt-6 flex items-center justify-between border-t border-border/60 pt-4">
              <Button variant="ghost" size="sm" onClick={() => edit(folder)}>
                <Pencil className="!size-3" />
                编辑分组
              </Button>
              <span className="text-[10px] text-muted-foreground/60">右键图标可编辑或移出</span>
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
