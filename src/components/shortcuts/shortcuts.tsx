import { useCallback, useRef, useState, useImperativeHandle, type RefObject } from 'react'
import { motion } from 'motion/react'
import { FolderClosed, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
import { ShortcutDnd } from './shortcut-dnd'
import { FolderDialogContent } from './folder-dialog'

export type ShortcutCommands = {
  addShortcut: () => void
  newFolder: () => void
  arrange: () => void
}

type EditorState =
  | { kind: 'shortcut'; item: Shortcut | null; parentId: string | null }
  | { kind: 'folder'; item: Folder | null }
  | null

export function Shortcuts({
  workspace,
  update,
  widgets,
  commandsRef,
}: {
  workspace: Workspace
  update: UpdateWorkspace
  widgets: DesktopWidget[]
  commandsRef: RefObject<ShortcutCommands | null>
}) {
  const arrangeRef = useRef<(() => void) | null>(null)
  const [folderId, setFolderId] = useState<string | null>(null)
  const [folderOpen, setFolderOpen] = useState(false)
  const closeFolder = useCallback(() => setFolderOpen(false), [])
  const [editor, setEditor] = useState<EditorState>(null)
  useImperativeHandle(
    commandsRef,
    () => ({
      addShortcut: () => setEditor({ kind: 'shortcut', item: null, parentId: null }),
      newFolder: () => setEditor({ kind: 'folder', item: null }),
      arrange: () => arrangeRef.current?.(),
    }),
    [],
  )
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
    <ShortcutDnd workspace={workspace} update={update}>
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
          onPositionsChange={(key, positions, moved) =>
            saveLayout('desktop', key, positions, moved)
          }
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
        />
        <Dialog open={folderOpen && !!folder} onOpenChange={setFolderOpen}>
          <FolderDialogContent
            folderId={folderId}
            onDragOutside={closeFolder}
            aria-describedby={undefined}
            style={folderAppearanceStyle(workspace.settings.icons)}
            className="folder-panel max-w-[820px] overflow-hidden bg-surface/95 px-7 py-5 text-foreground"
          >
            <DialogHeader className="mb-3 shrink-0 flex-row items-center gap-2">
              <DialogTitle className="flex min-w-0 items-center gap-2.5 text-lg">
                <FolderClosed size={20} className="shrink-0 text-muted-foreground" />
                <span className="truncate">{folder?.title}</span>
              </DialogTitle>
              {folder && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  aria-label="编辑分组"
                  onClick={() => edit(folder)}
                >
                  <Pencil className="!size-3.5" />
                </Button>
              )}
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
          </FolderDialogContent>
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
    </ShortcutDnd>
  )
}
