import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { ArrowRight, ChevronDown, Search } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { searchEngines, type Workspace, type UpdateWorkspace } from '@/lib/workspace'

export function ClockSearch({
  workspace,
  update,
}: {
  workspace: Workspace
  update: UpdateWorkspace
}) {
  const [now, setNow] = useState(new Date())
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const engine = searchEngines[workspace.settings.searchEngine]
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (
        event.key === '/' &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) &&
        !target.isContentEditable &&
        !document.querySelector('[role="dialog"]')
      ) {
        event.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const hours = now.getHours().toString().padStart(2, '0')
  const minutes = now.getMinutes().toString().padStart(2, '0')
  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      className="clock-section flex flex-col items-center pb-9 pt-0 text-center"
    >
      <div
        className="clock-face relative flex items-center justify-center font-light leading-[1.17] tracking-[-.065em] text-desktop-foreground"
        aria-label={`现在时间 ${hours}:${minutes}`}
      >
        <span>{hours}</span>
        <span className="clock-colon -mt-2 px-1 font-extralight text-primary/50">:</span>
        <span>{minutes}</span>
        {workspace.settings.showSeconds && (
          <span className="ml-3 self-end pb-5 text-[27px] tracking-normal text-desktop-muted">
            {now.getSeconds().toString().padStart(2, '0')}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center gap-3 text-[11px] tracking-[.08em] text-desktop-muted">
        <span>{now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}</span>
        <span className="size-[3px] rounded-full bg-primary/30" />
        <span>{now.toLocaleDateString('zh-CN', { weekday: 'long' })}</span>
      </div>
      <form
        action={engine.url.split('?')[0]}
        onSubmit={(event) => {
          event.preventDefault()
          if (query.trim()) {
            const url = `${engine.url}${encodeURIComponent(query.trim())}`
            if (workspace.settings.openInNewTab) window.open(url, '_blank', 'noopener,noreferrer')
            else window.location.assign(url)
          }
        }}
        className="search-bar group mt-6 flex h-[50px] w-full max-w-[580px] items-center rounded-[18px] border border-surface-border/70 bg-card/75 px-2 shadow-[0_6px_30px_-12px_#0000000a] backdrop-blur-lg transition-all duration-300 focus-within:-translate-y-0.5 focus-within:bg-surface/95 focus-within:shadow-[0_10px_40px_-12px_#00000014]"
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`选择搜索引擎，当前${engine.label}`}
              className="flex h-9 items-center gap-1 rounded-xl px-3 text-muted-foreground transition-colors hover:bg-primary/5"
            >
              <span className="w-4 text-center font-serif text-lg font-bold text-primary/80">
                {engine.letter}
              </span>
              <ChevronDown size={10} className="text-muted-foreground/60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {Object.entries(searchEngines).map(([key, value]) => (
              <DropdownMenuCheckboxItem
                key={key}
                checked={key === workspace.settings.searchEngine}
                onCheckedChange={() =>
                  update((state) => ({
                    ...state,
                    settings: {
                      ...state.settings,
                      searchEngine: key as Workspace['settings']['searchEngine'],
                    },
                  }))
                }
              >
                {value.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="mx-1 h-4 w-px bg-primary/10" />
        <Search size={16} className="ml-3 shrink-0 text-primary/35" />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="搜索内容"
          placeholder="搜索点什么，或去看看世界"
          className="h-full min-w-0 flex-1 bg-transparent px-3 text-[12px] text-foreground outline-none placeholder:text-muted-foreground/65"
        />
        <kbd className="mr-2 rounded border border-primary/10 px-1.5 py-0.5 text-[10px] text-muted-foreground/50 group-focus-within:hidden">
          /
        </kbd>
        <button
          type="submit"
          aria-label="开始搜索"
          className="mr-1 flex size-8 items-center justify-center rounded-xl text-primary/55 transition-all hover:bg-primary/8 hover:text-primary"
        >
          <ArrowRight size={17} strokeWidth={1.5} />
        </button>
      </form>
    </motion.header>
  )
}
