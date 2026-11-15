import { Plus } from 'lucide-react'

export function ActionVisual({ label }: { label: string }) {
  return (
    <span className="site-visual relative block size-full">
      <span className="site-icon site-icon-preset flex items-center justify-center border border-surface-border/65 bg-shortcut text-primary/60">
        <Plus size={25} strokeWidth={1.6} />
      </span>
      <span className="tile-label site-label">{label}</span>
    </span>
  )
}
