import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

export function DialogContent({
  className,
  children,
  overlay = true,
  position = 'center',
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & {
  overlay?: boolean
  position?: 'center' | 'right'
}) {
  return (
    <DialogPrimitive.Portal>
      {overlay && (
        <DialogPrimitive.Overlay className="dialog-overlay fixed inset-0 z-50 bg-overlay" />
      )}
      <DialogPrimitive.Content
        className={cn(
          'dialog-content fixed z-50 flex flex-col overflow-hidden bg-surface p-7 outline-none',
          position === 'center'
            ? 'left-1/2 top-1/2 max-h-[88dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-[26px] border border-surface-border/60 shadow-[0_30px_120px_-20px_#00000040]'
            : 'inset-y-0 right-0 h-dvh w-full max-w-[560px] overflow-y-auto rounded-l-[24px] border-l border-surface-border',
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className="absolute right-5 top-5 flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-primary/8 hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
          aria-label="关闭弹窗"
        >
          <X size={17} />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

export function DialogHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('mb-6 flex flex-col gap-1.5 pr-8', className)} {...props} />
}
export function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn('text-xl font-semibold tracking-tight', className)}
      {...props}
    />
  )
}
export function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn('text-xs leading-relaxed text-muted-foreground', className)}
      {...props}
    />
  )
}
