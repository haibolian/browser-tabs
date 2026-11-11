import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowDownLeft,
  Check,
  CheckCheck,
  CheckSquare2,
  Maximize2,
  MoreHorizontal,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tip } from '@/components/ui/tooltip'
import { createId, type Todo, type Workspace, type UpdateWorkspace } from '@/lib/workspace'
import { cn } from '@/lib/utils'
import { WidgetCard, WidgetHeader } from './widget-card'

function TodoList({
  todos,
  update,
  expanded = false,
}: {
  todos: Todo[]
  update: UpdateWorkspace
  expanded?: boolean
}) {
  const [draft, setDraft] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const remaining = todos.filter((todo) => !todo.done).length
  const done = todos.length - remaining

  function addTodo() {
    if (!draft.trim()) return
    const todo: Todo = { id: createId(), text: draft.trim(), done: false, createdAt: Date.now() }
    update((state) => ({ ...state, todos: [...state.todos, todo] }))
    setDraft('')
    requestAnimationFrame(() => {
      const reduceMotion =
        window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
        document.documentElement.dataset.reducedMotion === 'true'
      listRef.current?.scrollTo({
        top: listRef.current.scrollHeight,
        behavior: reduceMotion ? 'auto' : 'smooth',
      })
    })
  }

  function removeTodo(todo: Todo) {
    const position = todos.findIndex((item) => item.id === todo.id)
    update((state) => ({ ...state, todos: state.todos.filter((item) => item.id !== todo.id) }))
    toast('待办已删除', {
      action: {
        label: '撤销',
        onClick: () =>
          update((state) => ({
            ...state,
            todos: [...state.todos.slice(0, position), todo, ...state.todos.slice(position)],
          })),
      },
    })
  }

  return (
    <>
      <div
        ref={listRef}
        className={cn(
          'task-scroll -mx-2 min-h-0 flex-1 overflow-y-auto px-2',
          expanded ? 'max-h-[47dvh] min-h-36' : 'h-[66px] shrink-0',
        )}
      >
        <AnimatePresence initial={false} mode="popLayout">
          {todos.map((todo) => (
            <motion.div
              key={todo.id}
              layout
              initial={{ opacity: 0, x: -8, height: 0 }}
              animate={{ opacity: 1, x: 0, height: 'auto' }}
              exit={{ opacity: 0, x: 15, height: 0 }}
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              className={cn(
                'group flex items-center gap-2.5 rounded-lg px-1 transition-colors hover:bg-primary/3',
                expanded ? 'min-h-11 py-1' : 'min-h-[33px]',
              )}
            >
              <Checkbox
                checked={todo.done}
                onCheckedChange={(checked) => {
                  update((state) => ({
                    ...state,
                    todos: state.todos.map((item) =>
                      item.id === todo.id ? { ...item, done: checked === true } : item,
                    ),
                  }))
                  if (checked)
                    toast('又完成一件小事', { icon: <Check size={15} />, duration: 1800 })
                }}
                aria-label={`完成待办：${todo.text}`}
              />
              <div className="relative min-w-0 flex-1">
                <input
                  aria-label={`编辑待办：${todo.text}`}
                  className={cn(
                    'w-full border-0 bg-transparent py-1.5 text-xs outline-none transition-colors placeholder:text-muted-foreground/50',
                    todo.done &&
                      'text-muted-foreground/65 line-through decoration-muted-foreground/40',
                  )}
                  value={todo.text}
                  onChange={(event) =>
                    update((state) => ({
                      ...state,
                      todos: state.todos.map((item) =>
                        item.id === todo.id ? { ...item, text: event.target.value } : item,
                      ),
                    }))
                  }
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.nativeEvent.isComposing)
                      document
                        .getElementById(expanded ? 'todo-draft-dialog' : 'todo-draft')
                        ?.focus()
                  }}
                  placeholder="写下这件事…"
                />
              </div>
              <button
                className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground/60 opacity-0 transition-all hover:bg-destructive/8 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                aria-label={`删除待办：${todo.text}`}
                onClick={() => removeTodo(todo)}
              >
                <X size={13} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
        {todos.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="todo-empty flex h-full min-h-32 flex-col items-center justify-center gap-2 py-5 text-muted-foreground"
          >
            <span className="flex size-10 items-center justify-center rounded-2xl bg-primary/6 text-primary/60">
              <CheckCheck size={21} />
            </span>
            <p className="text-xs">清空思绪，从一件小事开始</p>
          </motion.div>
        )}
      </div>
      <form
        className="mt-2 flex h-8 shrink-0 items-center gap-2 rounded-xl border border-primary/8 bg-primary/3 px-3 transition-all focus-within:border-primary/30 focus-within:bg-surface-raised/60 focus-within:shadow-[0_0_0_3px_#00000008]"
        onSubmit={(event) => {
          event.preventDefault()
          addTodo()
        }}
      >
        <Plus size={15} className="shrink-0 text-primary/55" />
        <input
          id={expanded ? 'todo-draft-dialog' : 'todo-draft'}
          autoComplete="off"
          aria-label={expanded ? '在弹窗添加待办' : '添加待办'}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={expanded ? '添加一件小事，按 Enter 保存' : '添加待办…'}
          className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/65"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="flex size-6 items-center justify-center rounded-md text-primary/70 transition-all hover:bg-primary/10 disabled:opacity-30"
          aria-label="保存待办"
        >
          <ArrowDownLeft size={14} />
        </button>
      </form>
      <div
        className={cn(
          'mt-4 shrink-0 items-center justify-between text-[10px] text-muted-foreground/75',
          expanded ? 'flex' : 'hidden',
        )}
      >
        <span>
          {remaining
            ? `慢慢来，还有 ${remaining} 件小事`
            : todos.length
              ? '今天的事，都好好完成了'
              : '今天，也可以从容一点'}
        </span>
        <span className="flex items-center gap-2 tabular-nums">
          <span className="h-1 w-14 overflow-hidden rounded-full bg-primary/7">
            <motion.span
              className="block h-full rounded-full bg-primary/45"
              animate={{ width: `${todos.length ? (done / todos.length) * 100 : 0}%` }}
              transition={{ type: 'spring', stiffness: 100, damping: 20 }}
            />
          </span>
          {done}/{todos.length}
        </span>
      </div>
    </>
  )
}

export function TodoWidget({
  workspace,
  update,
  onExpand,
}: {
  workspace: Workspace
  update: UpdateWorkspace
  onExpand: () => void
}) {
  const completed = workspace.todos.filter((todo) => todo.done)
  return (
    <WidgetCard>
      <WidgetHeader className="mb-2 flex items-center gap-2">
        <span className="widget-icon bg-todo-surface text-todo-accent">
          <CheckSquare2 size={18} strokeWidth={1.8} />
        </span>
        <h2 className="text-xs font-medium">
          <button onClick={onExpand} aria-label="打开待办清单">
            待办
          </button>
        </h2>
        <span className="ml-0.5 rounded-md bg-primary/6 px-1.5 py-0.5 text-[10px] tabular-nums text-primary/70">
          {workspace.todos.filter((todo) => !todo.done).length}
        </span>
        <div className="ml-auto flex gap-1">
          <DropdownMenu>
            <Tip label="更多操作">
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-7" aria-label="待办更多操作">
                  <MoreHorizontal size={16} />
                </Button>
              </DropdownMenuTrigger>
            </Tip>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                disabled={!completed.length}
                onSelect={() => {
                  update((state) => ({ ...state, todos: state.todos.filter((todo) => !todo.done) }))
                  toast(`已清理 ${completed.length} 项已完成待办`, {
                    action: {
                      label: '撤销',
                      onClick: () =>
                        update((state) => ({ ...state, todos: [...state.todos, ...completed] })),
                    },
                  })
                }}
              >
                <Trash2 />
                清理已完成
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Tip label="展开待办">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label="展开待办"
              onClick={onExpand}
            >
              <Maximize2 className="!size-3.5" />
            </Button>
          </Tip>
        </div>
      </WidgetHeader>
      <TodoList todos={workspace.todos} update={update} />
    </WidgetCard>
  )
}

export function TodoDialog({
  open,
  onOpenChange,
  workspace,
  update,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspace: Workspace
  update: UpdateWorkspace
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <CheckSquare2 size={21} className="text-primary" />
            待办清单
          </DialogTitle>
          <DialogDescription>一件一件来，把注意力留给当下。点击文字即可编辑。</DialogDescription>
        </DialogHeader>
        <TodoList todos={workspace.todos} update={update} expanded />
      </DialogContent>
    </Dialog>
  )
}
