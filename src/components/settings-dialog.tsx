import { useRef, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  Feather,
  HardDrive,
  Settings2,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { WallpaperPanel } from '@/components/wallpaper-panel'
import { exportWorkspace, importWorkspace } from '@/lib/storage'
import type { Settings, Workspace, UpdateWorkspace } from '@/lib/workspace'
import type { ColorMode, ResolvedTheme } from '@/lib/theme'
import { IconSettings } from '@/components/shortcuts/icon-settings'
import type { ImportedBackup } from '@/lib/infinity-backup'

export function SettingsDialog({
  open,
  onOpenChange,
  workspace,
  update,
  onImport,
  imageUrl,
  resolvedTheme,
  onArrangeDesktop,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspace: Workspace
  update: UpdateWorkspace
  onImport: (workspace: Workspace) => void
  imageUrl: string | null
  resolvedTheme: ResolvedTheme
  onArrangeDesktop: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [pendingImport, setPendingImport] = useState<ImportedBackup | null>(null)
  const set = (
    key: keyof Pick<Settings, 'openInNewTab' | 'showSeconds' | 'showWidgets' | 'reducedMotion'>,
    value: boolean,
  ) => update((state) => ({ ...state, settings: { ...state.settings, [key]: value } }))
  async function downloadBackup() {
    setBusy(true)
    try {
      const data = await exportWorkspace(workspace)
      const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }))
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `留白备份-${new Date().toLocaleDateString('sv-SE')}.json`
      anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast('备份文件已导出')
    } catch (error) {
      toast.error(`导出失败：${error instanceof Error ? error.message : '无法创建备份'}`)
    } finally {
      setBusy(false)
    }
  }
  async function readBackup(file: File) {
    setBusy(true)
    try {
      setPendingImport(await importWorkspace(await file.text(), workspace.settings))
    } catch (error) {
      toast.error(`导入失败：${error instanceof Error ? error.message : '文件格式不正确'}`)
    } finally {
      setBusy(false)
    }
  }
  const options = [
    {
      key: 'openInNewTab' as const,
      title: '在新标签页打开网站',
      detail: '让这个小小的桌面一直在这里',
    },
    { key: 'showSeconds' as const, title: '时钟显示秒数', detail: '看时间轻轻地流过' },
    {
      key: 'showWidgets' as const,
      title: '显示桌面小组件',
      detail: '在图标网格中显示待办和随手记',
    },
    { key: 'reducedMotion' as const, title: '减少动画', detail: '保留必要的反馈，减少位移与缩放' },
  ]
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
        <DialogContent position="right" overlay={false} className="settings-panel">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              <Settings2 size={21} className="text-primary" />
              偏好设置
            </DialogTitle>
            <DialogDescription>用你习惯的方式，打开新的一页。</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="general">
            <TabsList className="mb-1 w-full">
              <TabsTrigger className="flex-1" value="general">
                常规
              </TabsTrigger>
              <TabsTrigger className="flex-1" value="wallpaper">
                主题与壁纸
              </TabsTrigger>
              <TabsTrigger className="flex-1" value="icons">
                图标
              </TabsTrigger>
              <TabsTrigger className="flex-1" value="data">
                数据备份
              </TabsTrigger>
            </TabsList>
            <TabsContent value="general">
              <div className="space-y-5">
                {options.map((option) => (
                  <div key={option.key} className="flex items-center justify-between gap-5">
                    <label htmlFor={`setting-${option.key}`} className="cursor-pointer">
                      <span className="block text-[13px]">{option.title}</span>
                      <span className="mt-1 block text-[10px] text-muted-foreground">
                        {option.detail}
                      </span>
                    </label>
                    <Switch
                      id={`setting-${option.key}`}
                      checked={workspace.settings[option.key]}
                      onCheckedChange={(value) => set(option.key, value)}
                    />
                  </div>
                ))}
                <div className="flex items-center justify-between gap-5 border-t border-border pt-5">
                  <div>
                    <span className="block text-[13px]">整理桌面图标</span>
                    <span className="mt-1 block text-[10px] text-muted-foreground">
                      按当前窗口的槽位排列，可撤销
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onArrangeDesktop()
                      onOpenChange(false)
                    }}
                  >
                    整理
                  </Button>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="wallpaper">
              <fieldset className="mb-7">
                <legend className="mb-3 text-xs font-medium">外观模式</legend>
                <div className="grid grid-cols-3 gap-2.5">
                  {(
                    [
                      { value: 'light', label: '纯白', icon: Sun },
                      { value: 'dark', label: '纯黑', icon: Moon },
                      { value: 'system', label: '跟随系统', icon: Monitor },
                    ] satisfies { value: ColorMode; label: string; icon: typeof Sun }[]
                  ).map((option) => (
                    <label key={option.value} className="relative cursor-pointer">
                      <input
                        type="radio"
                        name="color-mode"
                        value={option.value}
                        aria-label={option.label}
                        className="peer sr-only"
                        checked={workspace.settings.theme === option.value}
                        onChange={() =>
                          update((state) => ({
                            ...state,
                            settings: { ...state.settings, theme: option.value },
                          }))
                        }
                      />
                      <span className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface/40 px-2 py-4 text-muted-foreground transition-all hover:bg-surface-hover peer-checked:border-primary/60 peer-checked:bg-primary/8 peer-checked:text-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
                        <option.icon size={21} strokeWidth={1.5} />
                        <span className="text-xs">{option.label}</span>
                      </span>
                      {workspace.settings.theme === option.value && (
                        <Check size={12} className="absolute right-2.5 top-2.5 text-primary" />
                      )}
                    </label>
                  ))}
                </div>
              </fieldset>
              <WallpaperPanel
                workspace={workspace}
                update={update}
                imageUrl={imageUrl}
                resolvedTheme={resolvedTheme}
              />
            </TabsContent>
            <TabsContent value="icons">
              <IconSettings
                value={workspace.settings.icons}
                onChange={(icons) =>
                  update((state) => ({ ...state, settings: { ...state.settings, icons } }))
                }
              />
            </TabsContent>
            <TabsContent value="data">
              <div className="mb-4 mt-4">
                <h3 className="flex items-center gap-2 text-xs font-medium">
                  <HardDrive size={14} className="text-primary/60" />
                  你的数据，由你保管
                </h3>
                <p className="mb-4 mt-2 text-[11px] leading-6 text-muted-foreground">
                  待办、备忘、网站和壁纸仅保存在当前浏览器。导出一份备份，就能在另一台设备上继续使用。
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 text-xs"
                    onClick={() => void downloadBackup()}
                    disabled={busy}
                  >
                    <ArrowDownToLine size={14} />
                    导出备份
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 text-xs"
                    onClick={() => inputRef.current?.click()}
                    disabled={busy}
                  >
                    <ArrowUpFromLine size={14} />
                    导入备份
                  </Button>
                </div>
                <input
                  ref={inputRef}
                  type="file"
                  accept="application/json,.json,.infinity"
                  aria-label="导入备份文件"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) void readBackup(file)
                    event.target.value = ''
                  }}
                />
                <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
                  支持留白 .json 和 Infinity v2 .infinity 备份，可迁移网站、分组、图标及随手记。
                </p>
              </div>
            </TabsContent>
          </Tabs>
          <div className="mt-6 flex items-center gap-2 rounded-xl bg-primary/4 px-3 py-3 text-[10px] text-muted-foreground">
            <Feather size={14} className="text-primary/65" />
            <span>留白 1.0.0</span>
            <span className="ml-auto flex items-center gap-1">
              <Check size={12} />
              本地存储，无需账号
            </span>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!pendingImport}
        onOpenChange={(value) => {
          if (!value) setPendingImport(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingImport?.source === 'infinity' ? '导入 Infinity 备份？' : '导入这份备份？'}
            </DialogTitle>
            <DialogDescription>
              当前内容会被备份替换。导入后可以通过提示中的「撤销」恢复。
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-2xl bg-primary/5 p-4 text-sm">
            {pendingImport?.workspace.todos.length} 项待办 · {pendingImport?.workspace.notes.length}{' '}
            篇备忘 ·{' '}
            {pendingImport?.workspace.items.reduce(
              (count, item) => count + (item.kind === 'folder' ? item.items.length : 1),
              0,
            )}{' '}
            个网站 ·{' '}
            {pendingImport?.workspace.items.filter((item) => item.kind === 'folder').length} 个分组
          </div>
          {!!pendingImport?.notices.length && (
            <ul className="mt-3 list-disc space-y-1 pl-4 text-xs leading-5 text-muted-foreground">
              {pendingImport.notices.map((notice) => (
                <li key={notice}>{notice}</li>
              ))}
            </ul>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPendingImport(null)}>
              取消
            </Button>
            <Button
              onClick={() => {
                if (pendingImport) {
                  const previous = workspace
                  onImport(pendingImport.workspace)
                  setPendingImport(null)
                  onOpenChange(false)
                  toast('备份已导入', {
                    duration: 8000,
                    action: { label: '撤销', onClick: () => onImport(previous) },
                  })
                }
              }}
            >
              导入并替换
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
