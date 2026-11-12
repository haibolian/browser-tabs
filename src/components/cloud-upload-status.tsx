import { Cloud, CloudOff, LoaderCircle } from 'lucide-react'
import type { CloudUploadState } from '@/lib/cloud-upload'
import { cn } from '@/lib/utils'

export function CloudUploadStatus({
  state,
  className,
}: {
  state: CloudUploadState
  className?: string
}) {
  if (state.phase === 'idle') return null
  const Icon =
    state.phase === 'error' ? CloudOff : state.phase === 'uploading' ? LoaderCircle : Cloud
  const label =
    state.phase === 'error'
      ? state.error
      : state.phase === 'uploading'
        ? '正在上传到云端…'
        : state.phase === 'waiting'
          ? '等待上传…'
          : state.phase === 'saved' && state.lastUpload
            ? `已上传到云端 · ${new Date(state.lastUpload.updatedAt).toLocaleTimeString()}`
            : null
  return (
    <div
      role={state.phase === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-center gap-2 text-[11px]',
        state.phase === 'error' ? 'text-destructive' : 'text-muted-foreground',
        className,
      )}
    >
      <Icon
        size={14}
        className={state.phase === 'uploading' ? 'shrink-0 animate-spin' : 'shrink-0'}
      />
      <span>{label}</span>
    </div>
  )
}
