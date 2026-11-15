import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { Check, ChevronRight } from 'lucide-react'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'
import {
  menuContentClass,
  menuItemClass,
  menuSubTriggerClass,
  menuSubContentClass,
} from './menu-styles'

export const DropdownMenu = DropdownMenuPrimitive.Root
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger
export const DropdownMenuSub = DropdownMenuPrimitive.Sub
export function DropdownMenuContent({
  className,
  sideOffset = 7,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        sideOffset={sideOffset}
        className={cn(menuContentClass, className)}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
}
export function DropdownMenuItem({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Item>) {
  return <DropdownMenuPrimitive.Item className={cn(menuItemClass, className)} {...props} />
}
export function DropdownMenuSeparator(
  props: ComponentProps<typeof DropdownMenuPrimitive.Separator>,
) {
  return <DropdownMenuPrimitive.Separator className="mx-2 my-1 h-px bg-border" {...props} />
}
export function DropdownMenuSubTrigger({
  children,
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.SubTrigger>) {
  return (
    <DropdownMenuPrimitive.SubTrigger className={cn(menuSubTriggerClass, className)} {...props}>
      {children}
      <ChevronRight className="ml-auto" />
    </DropdownMenuPrimitive.SubTrigger>
  )
}
export function DropdownMenuSubContent(
  props: ComponentProps<typeof DropdownMenuPrimitive.SubContent>,
) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.SubContent className={menuSubContentClass} {...props} />
    </DropdownMenuPrimitive.Portal>
  )
}
export function DropdownMenuCheckboxItem({
  children,
  checked,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      checked={checked}
      className="flex cursor-pointer items-center justify-between gap-4 rounded-lg px-3 py-2.5 text-xs outline-none focus:bg-primary/8"
      {...props}
    >
      {children}
      <DropdownMenuPrimitive.ItemIndicator>
        <Check size={14} />
      </DropdownMenuPrimitive.ItemIndicator>
    </DropdownMenuPrimitive.CheckboxItem>
  )
}
