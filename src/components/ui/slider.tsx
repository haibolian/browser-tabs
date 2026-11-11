import * as SliderPrimitive from '@radix-ui/react-slider'
import type { ComponentProps } from 'react'

export function Slider(props: ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root
      className="relative flex h-6 w-full touch-none select-none items-center"
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-primary/10">
        <SliderPrimitive.Range className="absolute h-full bg-primary/70" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={props['aria-label']}
        aria-labelledby={props['aria-labelledby']}
        className="block size-4 rounded-full border-2 border-surface bg-primary shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </SliderPrimitive.Root>
  )
}
