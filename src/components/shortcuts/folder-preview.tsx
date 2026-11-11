import { useLayoutEffect, useRef, useState } from 'react'
import type { useDraggable } from '@dnd-kit/core'
import type { Folder } from '@/lib/workspace'
import type { IconSize } from '@/lib/desktop-layout'
import type { IconAppearance } from '@/lib/icon-appearance'
import { getFolderPreview } from '@/lib/folder-preview'
import { SiteIcon } from './site-icon'

export type FolderInteraction = {
  open: () => void
  openInNewTab: boolean
  drag?: Pick<ReturnType<typeof useDraggable>, 'attributes' | 'listeners'>
}

export function FolderPreview({
  folder,
  size,
  appearance,
  interaction,
}: {
  folder: Folder
  size: IconSize
  appearance: IconAppearance
  interaction?: FolderInteraction
}) {
  const rootRef = useRef<HTMLSpanElement>(null)
  const [bounds, setBounds] = useState<{ width: number; height: number } | null>(null)
  useLayoutEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setBounds({ width: entry.contentRect.width, height: entry.contentRect.height }),
    )
    observer.observe(rootRef.current!)
    return () => observer.disconnect()
  }, [])
  // Measure the actual animated box, so resizing never stretches a child icon.
  const items =
    bounds?.width && bounds.height
      ? getFolderPreview(size, bounds.width, bounds.height, folder.items.length, appearance)
      : []
  return (
    <span
      ref={rootRef}
      className="folder-icon relative block size-full"
      data-folder-size={size}
      style={{ borderRadius: appearance.radius }}
      aria-hidden={!interaction || undefined}
    >
      {interaction && (
        <button
          type="button"
          {...interaction.drag?.attributes}
          {...interaction.drag?.listeners}
          className="folder-open absolute inset-0 size-full"
          onClick={interaction.open}
          aria-label={`打开分组：${folder.title}`}
        />
      )}
      {items.map((item) => {
        const site = folder.items[item.index]
        const style = {
          left: item.left,
          top: item.top,
          width: item.size,
          height: item.size,
          borderRadius: item.radius,
        }
        const icon = <SiteIcon site={site} mini={item.mini} className="site-icon-fill" />
        return item.direct && interaction ? (
          <a
            key={site.id}
            href={site.url}
            target={interaction.openInNewTab ? '_blank' : '_self'}
            rel="noreferrer"
            draggable={false}
            title={site.title}
            aria-label={`打开分组网站：${site.title}`}
            className="folder-preview-item folder-preview-link absolute"
            data-folder-index={item.index}
            style={style}
          >
            {icon}
          </a>
        ) : (
          <span
            key={site.id}
            className="folder-preview-item pointer-events-none absolute"
            data-folder-index={item.index}
            style={style}
            aria-hidden
          >
            {icon}
          </span>
        )
      })}
    </span>
  )
}
