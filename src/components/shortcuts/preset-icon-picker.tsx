import { useState } from 'react'
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  findPresetIcons,
  presetCategories,
  presetIconLabel,
  presetIcons,
  type IconName,
  type PresetCategory,
} from '@/lib/icon-presets'
import { cn } from '@/lib/utils'
import { SiteIcon } from './site-icon'

const pageSize = 48

export function PresetIconPicker({
  value,
  color,
  onChange,
}: {
  value: IconName
  color: string
  onChange: (icon: IconName) => void
}) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<PresetCategory | 'all'>('all')
  const [page, setPage] = useState(() =>
    Math.max(0, Math.floor(presetIcons.findIndex((icon) => icon.id === value) / pageSize)),
  )
  const results = findPresetIcons(query, category)
  const pages = Math.ceil(results.length / pageSize)
  const currentPage = Math.min(page, Math.max(0, pages - 1))

  return (
    <fieldset className="space-y-3">
      <legend className="mb-3 text-xs text-muted-foreground">系统预设图标</legend>
      <div className="relative">
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          aria-label="搜索系统预设图标"
          placeholder="搜索图标"
          className="pl-9 pr-10 [&::-webkit-search-cancel-button]:appearance-none"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setPage(0)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.preventDefault()
          }}
        />
        {query && (
          <button
            type="button"
            aria-label="清空图标搜索"
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-xl text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
            onClick={() => {
              setQuery('')
              setPage(0)
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>
      <div role="group" aria-label="预设图标分类" className="flex flex-wrap gap-1.5">
        {[{ id: 'all', label: '全部' } as const, ...presetCategories].map((entry) => (
          <button
            key={entry.id}
            type="button"
            aria-pressed={category === entry.id}
            className={cn(
              'rounded-lg px-2.5 py-1.5 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-primary',
              category === entry.id
                ? 'bg-foreground text-background'
                : 'bg-surface-hover text-muted-foreground hover:text-foreground',
            )}
            onClick={() => {
              setCategory(entry.id)
              setPage(0)
            }}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <div
        role="group"
        aria-label="预设图标选项"
        className="grid grid-cols-[repeat(auto-fill,minmax(36px,1fr))] gap-1"
      >
        {results.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map((icon) => (
          <button
            type="button"
            key={icon.id}
            aria-label={`选择图标 ${icon.label}`}
            title={`${icon.label} · ${icon.id}`}
            aria-pressed={value === icon.id}
            className={cn(
              'flex aspect-square min-w-0 items-center justify-center rounded-lg border transition-colors focus-visible:outline-2 focus-visible:outline-primary',
              value === icon.id
                ? 'border-foreground bg-primary/8'
                : 'border-transparent hover:border-border hover:bg-surface-hover',
            )}
            onClick={() => onChange(icon.id)}
          >
            <SiteIcon
              site={{ icon: icon.id, color }}
              mini
              className="!size-7 !border-0 !bg-transparent [&_svg]:!size-5"
            />
          </button>
        ))}
      </div>
      {results.length === 0 && (
        <div role="status" className="py-5 text-center text-xs text-muted-foreground">
          未找到图标
          <button
            type="button"
            className="ml-2 text-foreground underline underline-offset-4"
            onClick={() => {
              setQuery('')
              setCategory('all')
              setPage(0)
            }}
          >
            查看全部
          </button>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{results.length} 个图标</span>
        <span role="status" className="sr-only">
          已选：{presetIconLabel(value)}
        </span>
        {pages > 1 && (
          <div role="group" aria-label="预设图标分页" className="flex items-center gap-2">
            <button
              type="button"
              aria-label="上一页图标"
              disabled={currentPage === 0}
              className="rounded-lg p-1.5 hover:bg-surface-hover disabled:opacity-30"
              onClick={() => setPage(currentPage - 1)}
            >
              <ChevronLeft size={16} />
            </button>
            <span aria-label={`第 ${currentPage + 1} 页，共 ${pages} 页`}>
              {currentPage + 1} / {pages}
            </span>
            <button
              type="button"
              aria-label="下一页图标"
              disabled={currentPage === pages - 1}
              className="rounded-lg p-1.5 hover:bg-surface-hover disabled:opacity-30"
              onClick={() => setPage(currentPage + 1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </fieldset>
  )
}
