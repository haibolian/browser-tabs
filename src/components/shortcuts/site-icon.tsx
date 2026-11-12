import { ImageOff } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import type { Shortcut } from '@/lib/workspace'
import { cn } from '@/lib/utils'
import { presetIconComponents } from './preset-icons'

function IconImage({ url, onError }: { url: string; onError?: () => void }) {
  const [failed, setFailed] = useState(false)
  if (failed)
    return (
      <span className="icon-image-error" title="图标加载失败" aria-label="图标加载失败">
        <ImageOff />
      </span>
    )
  return (
    <img
      src={url}
      alt=""
      draggable={false}
      referrerPolicy="no-referrer"
      className="site-icon-image"
      onError={() => {
        setFailed(true)
        onError?.()
      }}
    />
  )
}

function TextIcon({ text }: { text: string }) {
  const boxRef = useRef<HTMLSpanElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)
  const [scale, setScale] = useState(0.94)
  useLayoutEffect(() => {
    const box = boxRef.current!
    const content = textRef.current!
    const observer = new ResizeObserver(() => {
      if (!content.scrollWidth || !content.scrollHeight) return
      setScale(
        Math.min(
          0.94,
          (box.clientWidth * 0.86) / content.scrollWidth,
          (box.clientHeight * 0.86) / content.scrollHeight,
        ),
      )
    })
    observer.observe(box)
    observer.observe(content)
    return () => observer.disconnect()
  }, [text])
  return (
    <span ref={boxRef} className="site-text-icon" aria-label={`文字图标：${text}`}>
      <span
        ref={textRef}
        className="site-icon-text"
        style={{ transform: `translate(-50%, -50%) scale(${scale})` }}
      >
        {text}
      </span>
    </span>
  )
}

export type SiteIconData = Pick<Shortcut, 'icon' | 'color'> &
  Partial<Pick<Shortcut, 'favicon' | 'iconSource' | 'iconText' | 'iconBackground' | 'uploadedIcon'>>

export function SiteIcon({
  site,
  mini = false,
  className,
  onImageError,
  imageKey = 0,
}: {
  site: SiteIconData
  mini?: boolean
  className?: string
  onImageError?: () => void
  imageKey?: number
}) {
  const Icon = site.icon === 'notion' ? null : presetIconComponents[site.icon]
  const preset = !site.iconSource || site.iconSource === 'preset'
  const image = site.iconSource === 'upload' ? site.uploadedIcon : site.favicon
  return (
    <span
      className={cn(
        'site-icon flex shrink-0 items-center justify-center',
        mini && 'site-icon-mini',
        preset && 'site-icon-preset border border-surface-border/65',
        className,
      )}
      style={{
        backgroundColor: preset
          ? mini
            ? `${site.color}12`
            : 'var(--shortcut)'
          : site.iconBackground,
        color: preset
          ? `color-mix(in srgb, ${site.color}, var(--icon-tint) var(--icon-tint-amount))`
          : '#ffffff',
      }}
    >
      {site.iconSource === 'text' ? (
        <TextIcon text={site.iconText ?? ''} />
      ) : !preset ? (
        image ? (
          <IconImage key={`${imageKey}:${image}`} url={image} onError={onImageError} />
        ) : (
          <span className="icon-image-error" title="尚未选择图片" aria-label="尚未选择图片">
            <ImageOff />
          </span>
        )
      ) : Icon ? (
        <Icon size={mini ? 13 : 26} strokeWidth={mini ? 2 : 1.7} />
      ) : (
        <span className={cn('font-serif font-bold', mini ? 'text-sm' : 'text-[30px]')}>N</span>
      )}
    </span>
  )
}
