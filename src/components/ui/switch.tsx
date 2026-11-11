import * as SwitchPrimitive from '@radix-ui/react-switch'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'relative inline-flex h-[23px] w-10 shrink-0 cursor-pointer items-center rounded-full bg-switch-track outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=checked]:bg-primary',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-[17px] translate-x-[3px] rounded-full bg-switch-thumb data-[state=checked]:bg-primary-foreground shadow-sm transition-transform duration-300 data-[state=checked]:translate-x-5" />
    </SwitchPrimitive.Root>
  )
}
