import { useState } from 'react'
import { FolderClosed } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  colors,
  createId,
  groupAllShortcuts,
  type Folder,
  type UpdateWorkspace,
} from '@/lib/workspace'
import { IconColorPicker } from './icon-color-picker'

export function FolderEditor({
  item,
  update,
  onClose,
}: {
  item: Folder | null
  update: UpdateWorkspace
  onClose: () => void
}) {
  const [title, setTitle] = useState(item?.title ?? '')
  const [color, setColor] = useState(item?.color ?? colors[0])
  const [groupAll, setGroupAll] = useState(false)
  const [error, setError] = useState('')
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? '编辑分组' : '新建分组'}</DialogTitle>
          <DialogDescription>把常用网站放在一起。</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault()
            if (!title.trim()) {
              setError('请输入分组名称')
              return
            }
            const folder: Folder = {
              id: item?.id ?? createId(),
              kind: 'folder',
              title: title.trim(),
              color,
              items: item?.items ?? [],
            }
            update((state) => ({
              ...state,
              items: groupAll
                ? groupAllShortcuts(state.items, folder)
                : item
                  ? state.items.map((entry) => (entry.id === item.id ? folder : entry))
                  : [...state.items, folder],
            }))
            toast(item ? '分组修改已保存' : '分组已创建')
            onClose()
          }}
        >
          <div className="flex justify-center">
            <span
              className="flex size-16 items-center justify-center rounded-[18px]"
              style={{ background: `${color}18`, color }}
            >
              <FolderClosed size={30} strokeWidth={1.5} />
            </span>
          </div>
          <label className="form-label">
            分组名称
            <Input
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="例如：灵感收集"
            />
          </label>
          <fieldset>
            <legend className="mb-3 text-xs text-muted-foreground">分组颜色</legend>
            <IconColorPicker
              value={color}
              label="分组颜色"
              onChange={(value) => setColor(value!)}
            />
          </fieldset>
          {!item && (
            <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-primary/4 p-3 text-xs">
              <Checkbox
                checked={groupAll}
                onCheckedChange={(checked) => setGroupAll(checked === true)}
                aria-label="将所有网站收进这个分组"
              />
              将所有网站收进这个分组
            </label>
          )}
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              取消
            </Button>
            <Button type="submit">{item ? '保存修改' : '创建分组'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
