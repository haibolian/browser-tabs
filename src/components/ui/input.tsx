import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      data-slot="input"
      className={cn(
        'flex h-11 w-full rounded-xl border border-input bg-field/50 px-3.5 py-2 text-sm outline-none transition-all placeholder:text-muted-foreground/65 focus-visible:border-primary/40 focus-visible:bg-surface-raised focus-visible:ring-3 focus-visible:ring-primary/8 disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}
