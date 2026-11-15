import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { createId, type Folder, type UpdateWorkspace } from '@/lib/workspace'

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
  const [error, setError] = useState('')
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{item ? '编辑分组' : '新建分组'}</DialogTitle>
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
              color: item?.color ?? '#82976d',
              items: item?.items ?? [],
            }
            update((state) => ({
              ...state,
              items: item
                ? state.items.map((entry) =>
                    entry.id === item.id ? { ...entry, title: folder.title } : entry,
                  )
                : [...state.items, folder],
            }))
            toast(item ? '分组修改已保存' : '分组已创建')
            onClose()
          }}
        >
          <label className="form-label">
            分组名称
            <Input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
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
