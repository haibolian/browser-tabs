import { useContext, type ReactNode, type SyntheticEvent } from 'react'
import { motion } from 'motion/react'
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

export function WidgetCard({
  children,
  className,
  index = 0,
}: {
  children: ReactNode
  className?: string
  index?: number
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 220, damping: 26, delay: 0.12 + index * 0.07 }}
      className={cn(
        'widget-card flex min-w-0 flex-col rounded-[19px] border border-surface-border/75 bg-card/75 p-4 backdrop-blur-xl',
        className,
      )}
    >
      {children}
    </motion.section>
  )
}
