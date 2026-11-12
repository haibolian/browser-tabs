import { useContext, type ReactNode, type SyntheticEvent } from 'react'
import { cn } from '@/lib/utils'
import { WidgetDragContext } from './widget-drag-context'

export function WidgetHeader({ children, className }: { children: ReactNode; className?: string }) {
  const drag = useContext(WidgetDragContext)
  const listeners = Object.fromEntries(
    Object.entries(drag?.listeners ?? {}).map(([name, handler]) => [
      name,
      (event: SyntheticEvent) => {
        if ((event.target as HTMLElement).closest('button[data-slot="button"], input, textarea'))
          return
        if (event.type === 'keydown' && (event.target as HTMLElement).closest('button')) return
        handler(event)
      },
    ]),
  )
  return (
    <div
      {...drag?.attributes}
      {...listeners}
      aria-label={drag ? `拖动${drag.label}组件` : undefined}
      className={cn('widget-header', className)}
    >
      {children}
    </div>
  )
}

export function WidgetCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        'widget-card flex min-w-0 flex-col rounded-[19px] border border-surface-border/75 bg-card/85 p-4',
        className,
      )}
    >
      {children}
    </section>
  )
}
