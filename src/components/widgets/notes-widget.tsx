import { AnimatePresence, motion } from 'motion/react'
import { ArrowUpRight, FileText, Plus, StickyNote, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Tip } from '@/components/ui/tooltip'
import type { Note, Workspace, UpdateWorkspace } from '@/lib/workspace'
import { cn } from '@/lib/utils'
import { WidgetCard, WidgetHeader } from './widget-card'

function dateLabel(timestamp: number) {
  const date = new Date(timestamp)
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

export function NotesWidget({
  notes,
  onOpen,
  onNew,
}: {
  notes: Note[]
  onOpen: (id: string) => void
  onNew: () => void
}) {
  return (
    <WidgetCard index={1} className="notes-widget">
      <WidgetHeader className="mb-2 flex items-center gap-2">
        <span className="widget-icon bg-note-surface text-note-accent">
          <StickyNote size={18} strokeWidth={1.8} />
        </span>
        <h2 className="text-xs font-medium">
          <button
            onClick={() => (notes.length ? onOpen(notes[0].id) : onNew())}
            aria-label="打开随手记"
          >
            随手记
          </button>
        </h2>
        <span className="text-[10px] text-muted-foreground/50">{notes.length}</span>
        <Tip label="新建备忘录">
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto size-7"
            onClick={onNew}
            aria-label="新建备忘录"
          >
            <Plus size={16} />
          </Button>
        </Tip>
      </WidgetHeader>
      <div className="task-scroll -mx-1 h-[66px] min-h-0 shrink-0 overflow-y-auto px-1">
        <AnimatePresence initial={false}>
          {[...notes]
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .map((note, index) => (
              <motion.button
                key={note.id}
                layout
                initial={{ opacity: 0, y: 7 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 15 }}
                onClick={() => onOpen(note.id)}
                className="group flex h-[33px] w-full items-center gap-2 rounded-lg px-1 text-left transition-colors hover:bg-surface-hover/65 focus-visible:outline-2 focus-visible:outline-primary"
              >
                <span
                  className={cn(
                    'size-1 shrink-0 rounded-full',
                    index % 3 === 0
                      ? 'bg-foreground/30'
                      : index % 3 === 1
                        ? 'bg-foreground/45'
                        : 'bg-foreground/60',
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="truncate text-xs font-normal">{note.title || '无标题备忘'}</h3>
                    <span className="note-date shrink-0 text-[9px] text-muted-foreground/65">
                      {dateLabel(note.updatedAt)}
                    </span>
                  </div>
                  <p className="sr-only">
                    {note.content.replace(/\n/g, ' ') || '写一点什么，让想法有处安放…'}
                  </p>
                </div>
                <ArrowUpRight
                  size={13}
                  className="mt-1 shrink-0 -translate-x-1 text-primary/50 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
                />
              </motion.button>
            ))}
        </AnimatePresence>
        {notes.length === 0 && (
          <button
            onClick={onNew}
            className="notes-empty flex h-full min-h-32 w-full flex-col items-center justify-center gap-2 rounded-xl text-muted-foreground transition-colors hover:bg-surface-hover/30"
          >
            <FileText size={24} strokeWidth={1.3} className="text-note-accent/70" />
            <span className="text-xs">有想法，就记下来</span>
          </button>
        )}
      </div>
      <button
        onClick={onNew}
        className="mt-2 flex h-8 shrink-0 items-center gap-2 rounded-xl border border-dashed border-note-accent/30 px-3 text-xs text-muted-foreground/80 transition-all hover:border-note-accent/60 hover:bg-surface-hover/50 hover:text-foreground"
      >
        <Plus size={14} />
        <span>写一条备忘</span>
      </button>
    </WidgetCard>
  )
}

export function NotesDialog({
  open,
  onOpenChange,
  selectedId,
  onSelect,
  workspace,
  update,
  onNew,
  saving,
  saveError,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedId: string | null
  onSelect: (id: string | null) => void
  workspace: Workspace
  update: UpdateWorkspace
  onNew: () => void
  saving: boolean
  saveError: string | null
}) {
  const selected = workspace.notes.find((note) => note.id === selectedId)
  function changeNote(values: Partial<Pick<Note, 'title' | 'content'>>) {
    if (!selected) return
    update((state) => ({
      ...state,
      notes: state.notes.map((note) =>
        note.id === selected.id ? { ...note, ...values, updatedAt: Date.now() } : note,
      ),
    }))
  }
  function deleteNote() {
    if (!selected) return
    const next = workspace.notes.filter((note) => note.id !== selected.id)
    update((state) => ({ ...state, notes: next }))
    onSelect(next[0]?.id ?? null)
    toast('备忘录已删除', {
      action: {
        label: '撤销',
        onClick: () => {
          update((state) => ({ ...state, notes: [...state.notes, selected] }))
          onSelect(selected.id)
        },
      },
    })
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[650px] max-w-[880px] gap-0 p-0 max-sm:h-[85dvh]">
        <div className="sr-only">
          <DialogTitle>随手记</DialogTitle>
          <DialogDescription>选择备忘录并编辑，内容自动保存在本机。</DialogDescription>
        </div>
        <div className="flex min-h-0 flex-1 max-sm:flex-col">
          <aside className="flex w-[220px] shrink-0 flex-col border-r border-border/70 bg-muted/50 p-4 max-sm:h-36 max-sm:w-full max-sm:border-b max-sm:border-r-0">
            <div className="mb-4 flex items-center gap-2 px-1 pt-1">
              <StickyNote size={17} className="text-primary/70" />
              <span className="text-sm font-semibold">随手记</span>
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto size-7 max-sm:mr-10"
                onClick={onNew}
                aria-label="在编辑器新建备忘录"
              >
                <Plus size={16} />
              </Button>
            </div>
            <div className="task-scroll min-h-0 flex-1 space-y-1.5 overflow-y-auto max-sm:flex max-sm:gap-2 max-sm:space-y-0">
              {[...workspace.notes]
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .map((note) => (
                  <button
                    key={note.id}
                    onClick={() => onSelect(note.id)}
                    className={cn(
                      'w-full rounded-xl border border-transparent p-3 text-left transition-all max-sm:min-w-36',
                      selectedId === note.id
                        ? 'border-primary/8 bg-surface-raised/85 shadow-sm'
                        : 'hover:bg-surface-hover/50',
                    )}
                  >
                    <div className="truncate text-xs font-medium">{note.title || '无标题备忘'}</div>
                    <div className="mt-1.5 truncate text-[10px] text-muted-foreground/65">
                      {note.content.slice(0, 28) || '还没有内容'}
                    </div>
                  </button>
                ))}
            </div>
            <span className="px-2 pt-3 text-[10px] text-muted-foreground/55 max-sm:hidden">
              {workspace.notes.length} 篇备忘 · 只属于你
            </span>
          </aside>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col px-8 pb-5 pt-14 max-sm:px-5 max-sm:pt-5">
            {selected ? (
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={selected.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.14 }}
                  className="flex min-h-0 flex-1 flex-col"
                >
                  <input
                    autoFocus
                    key={`${selected.id}-title`}
                    aria-label="备忘录标题"
                    value={selected.title}
                    onChange={(event) => changeNote({ title: event.target.value })}
                    className="w-full bg-transparent text-2xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/40"
                    placeholder="无标题备忘"
                  />
                  <div className="mb-6 mt-3 flex items-center gap-2 text-[10px] text-muted-foreground/60">
                    <span>{dateLabel(selected.updatedAt)}</span>
                    <span>·</span>
                    <span>{selected.content.length} 字</span>
                  </div>
                  <textarea
                    aria-label="备忘录正文"
                    value={selected.content}
                    onChange={(event) => changeNote({ content: event.target.value })}
                    placeholder="把想到的，都留在这里…"
                    className="task-scroll min-h-20 flex-1 resize-none bg-transparent text-[13px] leading-[2] text-foreground/80 outline-none placeholder:text-muted-foreground/40"
                  />
                  <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
                    <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
                      <span
                        className={cn(
                          'size-1 rounded-full',
                          saving ? 'animate-pulse bg-amber-400' : 'bg-primary/60',
                        )}
                      />
                      {saveError
                        ? '保存失败，请关闭弹窗后重试保存'
                        : saving
                          ? '正在保存…'
                          : '已自动保存到本机'}
                    </span>
                    <Tip label="删除这篇备忘">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 hover:text-destructive"
                        aria-label="删除当前备忘录"
                        onClick={deleteNote}
                      >
                        <Trash2 className="!size-3.5" />
                      </Button>
                    </Tip>
                  </div>
                </motion.div>
              </AnimatePresence>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 text-muted-foreground">
                <StickyNote size={36} strokeWidth={1} />
                <p className="text-sm">这里，留给你的想法</p>
                <Button variant="secondary" onClick={onNew}>
                  <Plus size={15} />
                  写第一篇备忘
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
