import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { CircleAlert, CloudOff, Feather } from 'lucide-react'
import { Toaster } from 'sonner'
import { Button } from '@/components/ui/button'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ClockSearch } from '@/components/clock-search'
import { SettingsDialog } from '@/components/settings-dialog'
import { Shortcuts } from '@/components/shortcuts/shortcuts'
import { NotesDialog, NotesWidget } from '@/components/widgets/notes-widget'
import { TodoDialog, TodoWidget } from '@/components/widgets/todo-widget'
import { useWorkspace } from '@/hooks/use-workspace'
import {
  createId,
  wallpapers,
  getWallpaperValue,
  type Workspace,
  type UpdateWorkspace,
} from '@/lib/workspace'
import { useTheme } from '@/hooks/use-theme'
import { loadImage } from '@/lib/storage'
import { cn } from '@/lib/utils'
import { iconAppearanceStyle } from '@/lib/icon-appearance'

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error)
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-8 text-center">
          <CircleAlert className="text-destructive" />
          <h1 className="text-lg font-medium">页面遇到了一点问题</h1>
          <p className="max-w-lg text-sm text-muted-foreground">{this.state.error.message}</p>
          <Button onClick={() => window.location.reload()}>重新加载</Button>
        </div>
      )
    return this.props.children
  }
}

function useWallpaperImage(imageId: string | null) {
  const [image, setImage] = useState<{ id: string; url: string; brightness: number } | null>(null)
  const [error, setError] = useState<{ id: string; message: string } | null>(null)
  useEffect(() => {
    if (!imageId) return
    let alive = true
    let objectUrl: string | undefined
    loadImage(imageId)
      .then(async (blob) => {
        const bitmap = await createImageBitmap(blob)
        const canvas = document.createElement('canvas')
        canvas.width = 16
        canvas.height = 16
        const context = canvas.getContext('2d')
        if (!context) {
          bitmap.close()
          throw new Error('无法分析壁纸颜色')
        }
        context.drawImage(bitmap, 0, 0, 16, 16)
        bitmap.close()
        const pixels = context.getImageData(0, 0, 16, 16).data
        let brightness = 0
        for (let index = 0; index < pixels.length; index += 4) {
          brightness +=
            (pixels[index] * 0.2126 + pixels[index + 1] * 0.7152 + pixels[index + 2] * 0.0722) / 255
        }
        brightness /= 256
        if (!alive) return
        objectUrl = URL.createObjectURL(blob)
        setImage({ id: imageId, url: objectUrl, brightness })
        setError(null)
      })
      .catch((err: Error) => {
        if (alive) setError({ id: imageId, message: err.message })
      })
    return () => {
      alive = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [imageId])
  return {
    imageUrl: image?.id === imageId ? image.url : null,
    imageBrightness: image?.id === imageId ? image.brightness : null,
    imageError: error?.id === imageId ? error.message : null,
  }
}

function Desktop({
  workspace,
  update,
  saving,
  saveError,
  retrySave,
  onImport,
}: {
  workspace: Workspace
  update: UpdateWorkspace
  saving: boolean
  saveError: string | null
  retrySave: () => void
  onImport: (workspace: Workspace) => void
}) {
  const [panel, setPanel] = useState<'todo' | 'notes' | 'settings' | null>(null)
  const arrangeRef = useRef<(() => void) | null>(null)
  const resolvedTheme = useTheme(workspace.settings.theme)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const { imageUrl, imageBrightness, imageError } = useWallpaperImage(workspace.settings.imageId)
  const background = wallpapers.find((wallpaper) => wallpaper.id === workspace.settings.wallpaper)
  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(workspace.settings.reducedMotion)
    return () => {
      delete document.documentElement.dataset.reducedMotion
    }
  }, [workspace.settings.reducedMotion])
  function newNote() {
    const id = createId()
    update((state) => ({
      ...state,
      notes: [{ id, title: '', content: '', updatedAt: Date.now() }, ...state.notes],
    }))
    setSelectedNoteId(id)
    setPanel('notes')
  }
  function openNote(id?: string) {
    setSelectedNoteId(id ?? workspace.notes[0]?.id ?? null)
    setPanel('notes')
  }
  const widgets = workspace.settings.showWidgets
    ? [
        {
          id: 'widget:todo',
          label: '待办',
          sizeKey: 'todo' as const,
          content: (
            <TodoWidget workspace={workspace} update={update} onExpand={() => setPanel('todo')} />
          ),
        },
        {
          id: 'widget:notes',
          label: '随手记',
          sizeKey: 'notes' as const,
          content: <NotesWidget notes={workspace.notes} onOpen={openNote} onNew={newNote} />,
        },
      ]
    : []

  return (
    <MotionConfig
      reducedMotion={workspace.settings.reducedMotion ? 'always' : 'user'}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
    >
      <div
        style={iconAppearanceStyle(workspace.settings.icons)}
        className={cn(
          'desktop relative flex h-dvh min-h-0 flex-col overflow-hidden',
          workspace.settings.wallpaper === 'uploaded' &&
            imageBrightness !== null &&
            (imageBrightness * (1 - workspace.settings.imageDim / 100) < 0.5
              ? 'dark-wallpaper'
              : 'light-wallpaper'),
        )}
      >
        <AnimatePresence initial={false}>
          <motion.div
            key={
              workspace.settings.wallpaper +
              resolvedTheme +
              (workspace.settings.wallpaper === 'uploaded' ? workspace.settings.imageId : '')
            }
            className="wallpaper fixed inset-0 -z-20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.65 }}
            style={{
              background: background ? getWallpaperValue(background, resolvedTheme) : undefined,
              ...(workspace.settings.wallpaper === 'uploaded' && imageUrl
                ? {
                    backgroundImage: `url("${imageUrl}")`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }
                : {}),
            }}
          />
        </AnimatePresence>
        {workspace.settings.wallpaper === 'uploaded' && (
          <div
            className="pointer-events-none fixed inset-0 -z-10 bg-black transition-opacity duration-300"
            style={{ opacity: workspace.settings.imageDim / 100 }}
          />
        )}
        <main
          style={{ maxWidth: Math.max(1220, workspace.settings.icons.maxWidth + 80) }}
          className="mx-auto flex min-h-0 w-full flex-1 flex-col px-10 pb-3 pt-5 max-sm:px-5"
        >
          {(saveError || imageError) && (
            <div
              role="alert"
              className="mx-auto mb-3 flex max-w-xl items-center justify-between gap-3 rounded-xl border border-amber-300/50 bg-amber-50/90 px-4 py-2.5 text-xs text-amber-900"
            >
              <span>{saveError || imageError}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={saveError ? retrySave : () => setPanel('settings')}
              >
                {saveError ? '重新保存' : '检查壁纸'}
              </Button>
            </div>
          )}
          <ClockSearch workspace={workspace} update={update} />
          <Shortcuts
            workspace={workspace}
            update={update}
            widgets={widgets}
            arrangeRef={arrangeRef}
            onSettings={() => setPanel('settings')}
          />
        </main>
      </div>
      <TodoDialog
        open={panel === 'todo'}
        onOpenChange={(open) => {
          if (!open) setPanel(null)
        }}
        workspace={workspace}
        update={update}
      />
      <NotesDialog
        open={panel === 'notes'}
        onOpenChange={(open) => {
          if (!open) setPanel(null)
        }}
        selectedId={selectedNoteId}
        onSelect={setSelectedNoteId}
        workspace={workspace}
        update={update}
        onNew={newNote}
        saving={saving}
        saveError={saveError}
      />
      <SettingsDialog
        open={panel === 'settings'}
        onOpenChange={(open) => {
          if (!open) setPanel(null)
        }}
        workspace={workspace}
        update={update}
        onImport={onImport}
        imageUrl={imageUrl}
        resolvedTheme={resolvedTheme}
        onArrangeDesktop={() => arrangeRef.current?.()}
      />
      <Toaster
        position="bottom-center"
        theme={resolvedTheme}
        toastOptions={{ className: 'blank-toast', duration: 4000 }}
        closeButton
      />
    </MotionConfig>
  )
}

export default function App() {
  const { workspace, setWorkspace, loadError, saveError, saving, retrySave } = useWorkspace()
  const update: UpdateWorkspace = useCallback(
    (updater) => {
      setWorkspace((current) => (current ? updater(current) : current))
    },
    [setWorkspace],
  )
  if (loadError)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-8 text-center">
        <CloudOff size={30} className="text-primary/60" />
        <h1 className="text-lg">无法打开本地空间</h1>
        <p className="max-w-lg text-xs leading-6 text-muted-foreground">{loadError}</p>
        <Button onClick={() => window.location.reload()}>重新读取</Button>
      </div>
    )
  if (!workspace)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <Feather size={30} strokeWidth={1.2} className="animate-pulse text-primary/60" />
        <span className="text-xs tracking-[.3em] text-primary/60">正在打开你的留白</span>
      </div>
    )
  return (
    <TooltipProvider>
      <Desktop
        workspace={workspace}
        update={update}
        saving={saving}
        saveError={saveError}
        retrySave={retrySave}
        onImport={setWorkspace}
      />
    </TooltipProvider>
  )
}
