import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { Check } from 'lucide-react'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export function Checkbox({ className, ...props }: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        'peer flex size-[19px] shrink-0 items-center justify-center rounded-[6px] border-[1.5px] border-primary/25 bg-field/50 text-primary-foreground outline-none transition-all duration-300 hover:border-primary hover:shadow-[0_0_0_4px_#0000000a] focus-visible:ring-2 focus-visible:ring-ring data-[state=checked]:border-primary data-[state=checked]:bg-primary',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="check-pop">
        <Check size={13} strokeWidth={2.7} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}
