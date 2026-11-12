import { useRef, useState } from 'react'
import { Check, ImagePlus, Sun, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { saveImage } from '@/lib/storage'
import {
  createId,
  wallpapers,
  getWallpaperValue,
  type Workspace,
  type UpdateWorkspace,
} from '@/lib/workspace'
import type { ResolvedTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'

export function WallpaperPanel({
  workspace,
  update,
  imageUrl,
  resolvedTheme,
}: {
  workspace: Workspace
  update: UpdateWorkspace
  imageUrl: string | null
  resolvedTheme: ResolvedTheme
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const selectedPreset = wallpapers.find((preset) => preset.id === workspace.settings.wallpaper)
  const initialTab = workspace.settings.wallpaper === 'uploaded' ? 'upload' : selectedPreset!.type
  async function upload(file: File) {
    setUploading(true)
    try {
      const bitmap = await createImageBitmap(file)
      bitmap.close()
      const id = createId()
      await saveImage(id, file)
      update((state) => ({
        ...state,
        settings: { ...state.settings, imageId: id, wallpaper: 'uploaded' },
      }))
      toast('壁纸已更换，图片仅保存在本机')
    } catch (error) {
      toast.error(`上传失败：${error instanceof Error ? error.message : '无法读取图片'}`)
    } finally {
      setUploading(false)
    }
  }
  return (
    <div>
      <Tabs defaultValue={initialTab}>
        <TabsList className="w-full">
          <TabsTrigger value="gradient" className="flex-1">
            柔和渐变
          </TabsTrigger>
          <TabsTrigger value="solid" className="flex-1">
            纯粹底色
          </TabsTrigger>
          <TabsTrigger value="upload" className="flex-1">
            我的图片
          </TabsTrigger>
        </TabsList>
        {(['gradient', 'solid'] as const).map((type) => (
          <TabsContent key={type} value={type}>
            <div className="grid grid-cols-3 gap-3">
              {wallpapers
                .filter((wallpaper) => wallpaper.type === type)
                .map((wallpaper) => (
                  <button
                    key={wallpaper.id}
                    aria-pressed={workspace.settings.wallpaper === wallpaper.id}
                    onClick={() =>
                      update((state) => ({
                        ...state,
                        settings: { ...state.settings, wallpaper: wallpaper.id },
                      }))
                    }
                    className="group text-left outline-none"
                  >
                    <span
                      className={cn(
                        'relative flex h-[82px] items-center justify-center rounded-2xl border-2 border-surface-border/65 transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-primary',
                        workspace.settings.wallpaper === wallpaper.id &&
                          'ring-2 ring-primary/60 ring-offset-2 ring-offset-surface',
                      )}
                      style={{ background: getWallpaperValue(wallpaper, resolvedTheme) }}
                    >
                      {workspace.settings.wallpaper === wallpaper.id && (
                        <span className="flex size-6 items-center justify-center rounded-full bg-primary/75 text-primary-foreground">
                          <Check size={13} />
                        </span>
                      )}
                    </span>
                    <span className="mt-2 block px-1 text-[11px] text-muted-foreground">
                      {wallpaper.name}
                    </span>
                  </button>
                ))}
            </div>
          </TabsContent>
        ))}
        <TabsContent value="upload">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            aria-label="上传壁纸图片"
            accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void upload(file)
              event.target.value = ''
            }}
          />
          {imageUrl && (
            <div className="relative mb-4 overflow-hidden rounded-2xl">
              <img src={imageUrl} alt="已上传的壁纸" className="h-40 w-full object-cover" />
              <div className="absolute inset-0 bg-black/5" />
              <Button
                variant="secondary"
                size="sm"
                className="absolute bottom-3 left-3 bg-surface/95 text-[11px]"
                onClick={() =>
                  update((state) => ({
                    ...state,
                    settings: { ...state.settings, wallpaper: 'uploaded' },
                  }))
                }
              >
                {workspace.settings.wallpaper === 'uploaded' ? <Check /> : <ImagePlus />}
                {workspace.settings.wallpaper === 'uploaded' ? '正在使用' : '使用这张图片'}
              </Button>
              <Button
                variant="secondary"
                size="icon"
                className="absolute right-2 top-2 size-7 rounded-full bg-surface/95"
                aria-label="移除上传的壁纸"
                onClick={() =>
                  update((state) => ({
                    ...state,
                    settings: {
                      ...state.settings,
                      imageId: null,
                      wallpaper:
                        state.settings.wallpaper === 'uploaded'
                          ? 'morning'
                          : state.settings.wallpaper,
                    },
                  }))
                }
              >
                <X className="!size-3.5" />
              </Button>
            </div>
          )}
          <button
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-primary/25 bg-primary/3 py-9 text-muted-foreground transition-all hover:border-primary/50 hover:bg-primary/5 disabled:opacity-50"
          >
            <span className="flex size-11 items-center justify-center rounded-2xl bg-surface-raised/70 text-primary/60">
              <Upload size={20} strokeWidth={1.5} />
            </span>
            <span className="text-xs">
              {uploading ? '正在保存图片…' : imageUrl ? '上传另一张图片' : '选择一张自己的图片'}
            </span>
            <span className="text-[10px] text-muted-foreground">
              PNG、JPG、WebP、GIF、AVIF · 仅保存在本机
            </span>
          </button>
        </TabsContent>
      </Tabs>
      {workspace.settings.wallpaper === 'uploaded' && (
        <div className="mt-6 border-t border-border pt-5">
          <label
            htmlFor="image-dim"
            className="mb-3 flex items-center justify-between text-xs text-muted-foreground"
          >
            <span className="flex items-center gap-2">
              <Sun size={14} />
              壁纸遮罩
            </span>
            <span>{workspace.settings.imageDim}%</span>
          </label>
          <Slider
            id="image-dim"
            aria-label="壁纸遮罩"
            min={0}
            max={60}
            step={1}
            value={[workspace.settings.imageDim]}
            onValueChange={([value]) =>
              update((state) => ({ ...state, settings: { ...state.settings, imageDim: value } }))
            }
          />
        </div>
      )}
      <p className="mt-6 text-center text-[10px] text-muted-foreground">简单一点，也很好看。</p>
    </div>
  )
}
