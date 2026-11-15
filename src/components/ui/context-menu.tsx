import * as Primitive from '@radix-ui/react-context-menu'
import { createContext, useContext, useMemo, type ComponentProps } from 'react'
import { ChevronRight } from 'lucide-react'
import { createMenuSession } from '@/lib/menu-session'
import { cn } from '@/lib/utils'
import {
  menuContentClass,
  menuItemClass,
  menuSubTriggerClass,
  menuSubContentClass,
} from './menu-styles'

const SessionContext = createContext<ReturnType<typeof createMenuSession> | null>(null)

export function ContextMenu({ onOpenChange, ...props }: ComponentProps<typeof Primitive.Root>) {
  const session = useMemo(() => createMenuSession(), [])
  return (
    <SessionContext.Provider value={session}>
      <Primitive.Root
        {...props}
        onOpenChange={(open) => {
          if (open)
            session.begin(
              document.activeElement instanceof HTMLElement ? document.activeElement : null,
            )
          onOpenChange?.(open)
        }}
      />
    </SessionContext.Provider>
  )
}

export function ContextMenuTrigger({
  onContextMenu,
  ...props
}: ComponentProps<typeof Primitive.Trigger>) {
  return (
    <Primitive.Trigger
      {...props}
      onContextMenu={(event) => {
        onContextMenu?.(event)
        event.stopPropagation()
      }}
    />
  )
}

export function ContextMenuContent({
  className,
  onCloseAutoFocus,
  style,
  ...props
}: ComponentProps<typeof Primitive.Content>) {
  const session = useContext(SessionContext)
  return (
    <Primitive.Portal>
      <Primitive.Content
        {...props}
        collisionPadding={8}
        className={cn(menuContentClass, className)}
        style={{ maxHeight: 'var(--radix-context-menu-content-available-height)', ...style }}
        onCloseAutoFocus={(event) => {
          onCloseAutoFocus?.(event)
          if (!event.defaultPrevented) session?.finish(event)
        }}
      />
    </Primitive.Portal>
  )
}

export function ContextMenuItem({
  onAction,
  onSelect,
  className,
  ...props
}: ComponentProps<typeof Primitive.Item> & { onAction?: () => void }) {
  const session = useContext(SessionContext)
  return (
    <Primitive.Item
      {...props}
      className={cn(menuItemClass, className)}
      onSelect={(event) => {
        onSelect?.(event)
        if (!event.defaultPrevented && onAction) session?.select(onAction)
      }}
    />
  )
}

export const ContextMenuSub = Primitive.Sub
export function ContextMenuSeparator(props: ComponentProps<typeof Primitive.Separator>) {
  return <Primitive.Separator className="mx-2 my-1 h-px bg-border" {...props} />
}
export function ContextMenuSubTrigger({
  children,
  className,
  ...props
}: ComponentProps<typeof Primitive.SubTrigger>) {
  return (
    <Primitive.SubTrigger {...props} className={cn(menuSubTriggerClass, className)}>
      {children}
      <ChevronRight className="ml-auto" />
    </Primitive.SubTrigger>
  )
}
export function ContextMenuSubContent({
  className,
  ...props
}: ComponentProps<typeof Primitive.SubContent>) {
  return (
    <Primitive.Portal>
      <Primitive.SubContent {...props} className={cn(menuSubContentClass, className)} />
    </Primitive.Portal>
  )
}
