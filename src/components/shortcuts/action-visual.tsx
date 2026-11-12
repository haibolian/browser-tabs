import { Plus, Settings2 } from 'lucide-react'

export function ActionVisual({ label, settings = false }: { label: string; settings?: boolean }) {
  const Icon = settings ? Settings2 : Plus
  return (
    <span className="site-visual relative block size-full">
      <span className="site-icon site-icon-preset flex items-center justify-center border border-surface-border/65 bg-shortcut text-primary/60">
        <Icon size={25} strokeWidth={1.6} />
      </span>
      <span className="tile-label site-label">{label}</span>
    </span>
  )
}
