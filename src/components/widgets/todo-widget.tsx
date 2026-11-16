import { useRef, useState } from 'react'
import { motion } from 'motion/react'
import {
  ArrowDownLeft,
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
        {todos.map((todo) => (
          <div
            key={todo.id}
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
              }}
              aria-label={`完成待办：${todo.text}`}
            />
            <div className="relative min-w-0 flex-1">
              <input
                aria-label={`编辑待办：${todo.text}`}
                className={cn(
                  'w-full border-0 bg-transparent py-1.5 text-xs outline-none transition-colors placeholder:text-muted-foreground',
                  todo.done && 'text-muted-foreground line-through decoration-muted-foreground/40',
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
                    document.getElementById(expanded ? 'todo-draft-dialog' : 'todo-draft')?.focus()
                }}
                placeholder="待办内容"
              />
            </div>
            <button
              className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-all hover:bg-destructive/8 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
              aria-label={`删除待办：${todo.text}`}
              onClick={() => removeTodo(todo)}
            >
              <X size={13} />
            </button>
          </div>
        ))}
        {todos.length === 0 && (
          <div className="todo-empty flex h-full min-h-32 flex-col items-center justify-center gap-2 py-5 text-muted-foreground">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-primary/6 text-primary/60">
              <CheckCheck size={21} />
            </span>
            <p className="text-xs">暂无待办</p>
          </div>
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
          placeholder="添加待办"
          className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
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
          'mt-4 shrink-0 items-center justify-between text-[10px] text-muted-foreground',
          expanded ? 'flex' : 'hidden',
        )}
      >
        <span>未完成 {remaining} 项</span>
        <span className="flex items-center gap-2 tabular-nums">
          <span className="h-1 w-14 overflow-hidden rounded-full bg-primary/7">
            <motion.span
              className="block h-full rounded-full bg-primary/45"
              style={{ width: '100%', transformOrigin: 'left' }}
              animate={{ scaleX: todos.length ? done / todos.length : 0 }}
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
      <DialogContent className="max-w-xl" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <CheckSquare2 size={21} className="text-primary" />
            待办清单
          </DialogTitle>
        </DialogHeader>
        <TodoList todos={workspace.todos} update={update} expanded />
      </DialogContent>
    </Dialog>
  )
}
