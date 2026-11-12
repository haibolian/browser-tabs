import { DesktopGrid, type DesktopGridProps } from './desktop-grid'
export type { DesktopWidget } from './desktop-grid'

export function IconGrid(props: DesktopGridProps) {
  return <DesktopGrid {...props} />
}
