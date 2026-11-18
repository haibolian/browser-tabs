import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function NativeDialog({
  open,
  onOpenChange,
  title,
  children,
  className,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      closedby="any"
      aria-labelledby={titleId}
      onClose={() => onOpenChange(false)}
      className={cn(
        'native-dialog m-auto max-h-[88dvh] w-[calc(100%-2rem)] max-w-2xl overflow-hidden rounded-[26px] border border-surface-border bg-surface p-7 text-foreground shadow-[0_30px_120px_-20px_#00000040]',
        className,
      )}
    >
      <h2
        id={titleId}
        className="mb-5 shrink-0 break-words pr-9 text-xl font-semibold tracking-tight"
      >
        {title}
      </h2>
      <button
        type="button"
        autoFocus
        aria-label="关闭弹窗"
        className="absolute right-5 top-5 flex min-h-8 min-w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-primary/8 hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
        onClick={() => ref.current?.close()}
      >
        <X size={17} aria-hidden="true" />
      </button>
      {children}
    </dialog>
  )
}
