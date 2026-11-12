import { useCallback, useRef, useState, type ReactNode } from 'react'
import { Check, FolderClosed, Globe2, Loader2, Plus, Type } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useSiteDetails } from '@/hooks/use-site-details'
import { initialIconText, readIconImage } from '@/lib/icon-appearance'
import type { SiteMetadata } from '@/lib/site-metadata'
import {
  colors,
  createId,
  normalizeUrl,
  upsertShortcut,
  type Shortcut,
  type UpdateWorkspace,
  type Workspace,
} from '@/lib/workspace'
import { cn } from '@/lib/utils'
import { IconColorPicker } from './icon-color-picker'
import { SiteIcon, type SiteIconData } from './site-icon'
import { PresetIconPicker } from './preset-icon-picker'

type IconChoice = 'current' | Shortcut['iconSource']

function IconOption({
  label,
  selected,
  onSelect,
  children,
}: {
  label: string
  selected: boolean
  onSelect: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className="icon-choice"
      aria-label={label}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <span className={cn('icon-choice-preview', selected && 'selected')}>
        {children}
        {selected && (
          <span className="icon-choice-check">
            <Check size={11} strokeWidth={3} />
          </span>
        )}
      </span>
      <span className="mt-1.5 block text-xs text-muted-foreground">{label}</span>
    </button>
  )
}

export function ShortcutEditor({
  item,
  initialParentId,
  workspace,
  update,
  onClose,
}: {
  item: Shortcut | null
  initialParentId: string | null
  workspace: Workspace
  update: UpdateWorkspace
  onClose: () => void
}) {
  const [title, setTitle] = useState(item?.title ?? '')
  const [url, setUrl] = useState(item?.url ?? '')
  const [icon, setIcon] = useState<Shortcut['icon']>(item?.icon ?? 'globe')
  const [color, setColor] = useState(item?.color ?? colors[0])
  const [background, setBackground] = useState(item?.iconBackground ?? '#1681ff')
  const [text, setText] = useState(item?.iconText || initialIconText(item?.title ?? '') || 'A')
  const [favicon, setFavicon] = useState(item?.favicon ?? null)
  const [uploadedIcon, setUploadedIcon] = useState(item?.uploadedIcon ?? null)
  const [choice, setChoice] = useState<IconChoice>(
    item && ['site', 'upload'].includes(item.iconSource) ? 'current' : (item?.iconSource ?? 'text'),
  )
  const [parentId, setParentId] = useState(initialParentId)
  const [error, setError] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [failedImage, setFailedImage] = useState<string | null>(null)
  const [imageRevision, setImageRevision] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)
  const manualTitle = useRef(!!item)
  const manualIcon = useRef(!!item && item.iconSource !== 'site')
  const manualText = useRef(!!item?.iconText)
  const manualBackground = useRef(false)
  const onMetadata = useCallback(
    (metadata: SiteMetadata) => {
      if (!manualTitle.current && metadata.title) setTitle(metadata.title)
      if (!manualText.current && metadata.title) setText(initialIconText(metadata.title))
      setFavicon(metadata.favicon)
      setImageRevision((revision) => revision + 1)
      setFailedImage(null)
      if (!manualIcon.current) {
        setChoice(
          metadata.favicon
            ? item?.iconSource === 'site' && metadata.favicon === item.favicon
              ? 'current'
              : 'site'
            : 'text',
        )
        if (!manualBackground.current && (!metadata.favicon || !item))
          setBackground(metadata.favicon ? '#ffffff' : '#1681ff')
      }
    },
    [item],
  )
  const siteDetails = useSiteDetails(url, !item || item.url !== url, onMetadata)
  const originalImage =
    item?.iconSource === 'site'
      ? item.favicon
      : item?.iconSource === 'upload'
        ? item.uploadedIcon
        : null
  const source = choice === 'current' ? item!.iconSource : choice
  const selectedFavicon = choice === 'current' ? item!.favicon : favicon
  const selectedUpload = choice === 'current' ? item!.uploadedIcon : uploadedIcon
  const image = source === 'site' ? selectedFavicon : source === 'upload' ? selectedUpload : null
  const preview: SiteIconData = {
    icon,
    color,
    iconSource: source,
    favicon: selectedFavicon,
    uploadedIcon: selectedUpload,
    iconText: text,
    iconBackground: background,
  }

  function select(next: IconChoice) {
    manualIcon.current = true
    setChoice(next)
    if (next === 'text' && next !== choice && ['transparent', '#ffffff'].includes(background))
      setBackground('#1681ff')
    setError('')
  }
  async function upload(file: File) {
    setUploading(true)
    setUploadError('')
    try {
      setUploadedIcon(await readIconImage(file))
      select('upload')
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : '无法读取这张图片')
    } finally {
      setUploading(false)
    }
  }
  function save() {
    try {
      const normalizedUrl = normalizeUrl(url)
      if (!title.trim()) throw new Error('请输入网站名称')
      if (source === 'text' && !text.trim()) throw new Error('请输入图标文字')
      if (source === 'site' && !selectedFavicon)
        throw new Error('未获取网站图标，请重新获取或更换图标')
      if (source === 'upload' && !selectedUpload) throw new Error('请先上传一张图标图片')
      if (image && failedImage === image)
        throw new Error('选中的图片加载失败，请重新获取或选择其他图标')
      const shortcut: Shortcut = {
        id: item?.id ?? createId(),
        kind: 'shortcut',
        title: title.trim(),
        url: normalizedUrl,
        icon,
        color,
        iconSource: source,
        favicon: selectedFavicon,
        uploadedIcon: selectedUpload,
        iconText: text.trim(),
        iconBackground: background,
      }
      update((state) => ({ ...state, items: upsertShortcut(state.items, shortcut, parentId) }))
      toast(item ? '图标修改已保存' : '网站已添加')
      onClose()
    } catch (error) {
      setError(error instanceof Error ? error.message : '无法保存这个图标')
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent
        className="icon-editor max-w-[740px] overflow-y-auto"
        aria-describedby={undefined}
      >
        <DialogHeader className="mb-4">
          <DialogTitle>{item ? '编辑图标' : '添加网站'}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            save()
          }}
        >
          <div className="icon-editor-section space-y-3">
            <label className="form-label">
              网站地址
              <span className="flex gap-2">
                <Input
                  aria-label="网站地址"
                  autoFocus
                  value={url}
                  inputMode="url"
                  className="min-w-0 flex-1"
                  onChange={(event) => {
                    setUrl(event.target.value)
                    setFavicon(null)
                    if (!manualTitle.current) setTitle('')
                  }}
                  onBlur={() => {
                    if (!item || item.url !== url) void siteDetails.read(true)
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!url.trim() || siteDetails.status === 'loading'}
                  onClick={() => void siteDetails.read(true, true)}
                >
                  {siteDetails.status === 'loading' && (
                    <Loader2 size={14} className="animate-spin" />
                  )}
                  {siteDetails.status === 'permission' ? '允许读取' : '获取图标'}
                </Button>
              </span>
            </label>
            <label className="form-label">
              网站名称
              <Input
                value={title}
                onChange={(event) => {
                  manualTitle.current = !!event.target.value
                  setTitle(event.target.value)
                  if (!manualText.current) setText(initialIconText(event.target.value))
                }}
              />
            </label>
            {siteDetails.message && (
              <p
                role={siteDetails.status === 'error' ? 'alert' : 'status'}
                className={cn(
                  'flex items-start gap-2 text-[11px] leading-5 text-muted-foreground',
                  siteDetails.status === 'error' && 'text-destructive',
                )}
              >
                <Globe2 size={13} className="mt-0.5 shrink-0" />
                {siteDetails.message}
              </p>
            )}
          </div>
          <div className="icon-editor-section space-y-3">
            <div className="flex flex-wrap items-start gap-3" role="group" aria-label="图标来源">
              {originalImage && item && (
                <IconOption
                  label="当前图标"
                  selected={choice === 'current'}
                  onSelect={() => select('current')}
                >
                  <SiteIcon
                    imageKey={imageRevision}
                    site={{ ...item, iconBackground: background }}
                    onImageError={() => setFailedImage(originalImage)}
                  />
                </IconOption>
              )}
              {favicon && favicon !== originalImage && (
                <IconOption
                  label="网站图标"
                  selected={choice === 'site'}
                  onSelect={() => select('site')}
                >
                  <SiteIcon
                    imageKey={imageRevision}
                    site={{ ...preview, iconSource: 'site', favicon }}
                    onImageError={() => setFailedImage(favicon)}
                  />
                </IconOption>
              )}
              <IconOption
                label="文字图标"
                selected={choice === 'text'}
                onSelect={() => select('text')}
              >
                <SiteIcon
                  site={{
                    ...preview,
                    iconSource: 'text',
                    iconBackground:
                      choice !== 'text' && ['transparent', '#ffffff'].includes(background)
                        ? '#1681ff'
                        : background,
                  }}
                />
              </IconOption>
              <IconOption
                label={uploading ? '读取图片中' : '上传图片'}
                selected={choice === 'upload'}
                onSelect={() => (uploadedIcon ? select('upload') : fileRef.current?.click())}
              >
                {uploading ? (
                  <Loader2 className="animate-spin text-muted-foreground" />
                ) : uploadedIcon ? (
                  <SiteIcon site={{ ...preview, iconSource: 'upload', uploadedIcon }} />
                ) : (
                  <Plus size={24} strokeWidth={1.5} className="text-muted-foreground" />
                )}
              </IconOption>
              <IconOption
                label="系统预设"
                selected={choice === 'preset'}
                onSelect={() => select('preset')}
              >
                <SiteIcon site={{ icon, color, iconSource: 'preset' }} />
              </IconOption>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.svg,.ico"
              className="hidden"
              aria-label="上传图标图片"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void upload(file)
                event.target.value = ''
              }}
            />
            {uploadedIcon && choice === 'upload' && (
              <button
                type="button"
                className="text-xs text-muted-foreground underline underline-offset-4"
                onClick={() => fileRef.current?.click()}
              >
                更换图片
              </button>
            )}
            {uploadError && (
              <p role="alert" className="text-xs text-destructive">
                {uploadError}
              </p>
            )}
            <label
              className={cn(
                'flex items-center gap-4 text-xs text-muted-foreground',
                choice !== 'text' && 'opacity-45',
              )}
            >
              <span className="shrink-0">图标文字</span>
              <span className="relative block w-[220px] max-w-full">
                <Type
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
                />
                <Input
                  value={text}
                  disabled={choice !== 'text'}
                  className="pl-9"
                  onChange={(event) => {
                    manualText.current = true
                    setText(event.target.value)
                  }}
                />
              </span>
            </label>
            {choice === 'preset' && (
              <PresetIconPicker value={icon} color={color} onChange={setIcon} />
            )}
            <fieldset>
              <legend className="mb-3 text-xs text-muted-foreground">
                {choice === 'preset' ? '系统图标颜色' : '图标背景色'}
              </legend>
              <IconColorPicker
                value={choice === 'preset' ? color : background}
                transparent={choice !== 'preset'}
                label={choice === 'preset' ? '系统图标颜色' : '图标背景色'}
                onChange={(value) => {
                  if (choice === 'preset') setColor(value!)
                  else {
                    manualBackground.current = true
                    setBackground(value!)
                  }
                }}
              />
            </fieldset>
          </div>
          <label className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="shrink-0">放置位置</span>
            <span className="flex items-center gap-2 rounded-xl border border-input bg-field/50 px-3">
              <FolderClosed size={14} className="shrink-0" />
              <select
                aria-label="网站放置位置"
                value={parentId ?? ''}
                onChange={(event) => setParentId(event.target.value || null)}
                className="h-10 w-full bg-transparent text-sm text-foreground outline-none"
              >
                <option value="">桌面</option>
                {workspace.items
                  .filter((entry) => entry.kind === 'folder')
                  .map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.title}
                    </option>
                  ))}
              </select>
            </span>
          </label>
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" disabled={uploading}>
              {item ? '保存修改' : '添加网站'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
