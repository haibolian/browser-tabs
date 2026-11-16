import { useDraggable, useDroppable } from '@dnd-kit/core'
import type { Folder, Shortcut } from '@/lib/workspace'
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import type { IconSize } from '@/lib/desktop-layout'
import type { IconAppearance } from '@/lib/icon-appearance'
import { getFolderPreview } from '@/lib/folder-preview'
import { SiteIcon } from './site-icon'
import { SiteTile, type TileHandlers } from './site-tile'
import { useShortcutDrag } from './shortcut-drag-context'

export type FolderInteraction = {
  open: () => void
  openInNewTab: boolean
  drag?: Pick<ReturnType<typeof useDraggable>, 'attributes' | 'listeners'>
  folders: Folder[]
  handlers: TileHandlers
}

function PreviewShortcut({
  site,
  folderId,
  interaction,
  appearance,
  style,
  index,
  mini,
}: {
  site: Shortcut
  folderId: string
  interaction: FolderInteraction
  appearance: IconAppearance
  style: CSSProperties
  index: number
  mini: boolean
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `preview:${folderId}:${site.id}`,
    data: { item: site, folderId, surface: 'preview', mini },
  })
  const drop = useDroppable({
    id: `preview-target:${folderId}:${site.id}`,
    data: {
      previewFolderId: folderId,
      drop: {
        kind: 'order',
        folderId,
        index,
      },
    },
  })
  const { activeItem } = useShortcutDrag()
  return (
    <span
      ref={(node) => {
        setNodeRef(node)
        drop.setNodeRef(node)
      }}
      className="folder-preview-item folder-preview-link absolute"
      data-folder-index={index}
      style={{ ...style, opacity: activeItem?.id === site.id ? 0 : 1 }}
    >
      <SiteTile
        {...interaction.handlers}
        item={site}
        folders={interaction.folders}
        currentFolderId={folderId}
        openInNewTab={interaction.openInNewTab}
        drag={{ attributes, listeners }}
        size="1x1"
        onResize={() => {}}
        appearance={appearance}
        compact
        mini={mini}
        isOver={drop.isOver && activeItem?.id !== site.id}
      />
    </span>
  )
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
    const node = rootRef.current!
    const measure = (width: number, height: number) => {
      setBounds((current) =>
        current?.width === width && current.height === height ? current : { width, height },
      )
    }
    measure(node.clientWidth, node.clientHeight)
    const observer = new ResizeObserver(([entry]) =>
      measure(entry.contentRect.width, entry.contentRect.height),
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
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
          left: 0,
          top: 0,
          translate: `${item.left}px ${item.top}px`,
          width: item.size,
          height: item.size,
          borderRadius: item.radius,
        }
        return item.direct && interaction ? (
          <PreviewShortcut
            key={site.id}
            site={site}
            folderId={folder.id}
            interaction={interaction}
            appearance={appearance}
            index={item.index}
            mini={item.mini}
            style={style}
          />
        ) : (
          <span
            key={site.id}
            className="folder-preview-item pointer-events-none absolute"
            data-folder-index={item.index}
            style={style}
            aria-hidden
          >
            <SiteIcon site={site} mini={item.mini} className="site-icon-fill" />
          </span>
        )
      })}
    </span>
  )
}
