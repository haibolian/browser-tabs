import { createContext } from 'react'
import type { useDraggable } from '@dnd-kit/core'

export const WidgetDragContext = createContext<
  (Pick<ReturnType<typeof useDraggable>, 'attributes' | 'listeners'> & { label: string }) | null
>(null)
