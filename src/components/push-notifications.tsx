import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Toaster, toast } from 'sonner'
import { NativeDialog } from '@/components/ui/native-dialog'
import type { PushMessage } from '@/lib/push-contract'
import type { CloudConnection } from '@/lib/cloud-api'
import type { ResolvedTheme } from '@/lib/theme'
import { usePushMessages } from '@/hooks/use-push-messages'

function MessagePreview({
  message,
  onRead,
  onOpen,
}: {
  message: PushMessage
  onRead: (id: string) => void
  onOpen: (message: PushMessage) => void
}) {
  const ref = useRef<HTMLParagraphElement>(null)
  const [truncated, setTruncated] = useState(false)
  useEffect(() => {
    const preview = ref.current
    if (!preview) return
    const measure = () =>
      setTruncated(
        preview.scrollHeight > preview.clientHeight + 1 ||
          preview.scrollWidth > preview.clientWidth + 1,
      )
    const observer = new ResizeObserver(measure)
    observer.observe(preview)
    const frame = requestAnimationFrame(measure)
    void document.fonts?.ready.then(measure)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [message.title, message.content])
  return (
    <div className="flex w-full items-start gap-3">
      <button
        type="button"
        disabled={!truncated}
        aria-label={
          truncated ? `查看完整消息：${message.title || message.content.slice(0, 30)}` : undefined
        }
        className="min-w-0 flex-1 rounded-sm text-left disabled:cursor-default focus-visible:outline-2 focus-visible:outline-primary"
        onClick={() => onOpen(message)}
      >
        <p
          ref={ref}
          className="push-message-preview line-clamp-2 whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere]"
        >
          {message.title && (
            <strong className="font-medium">
              {message.title}
              {'\n'}
            </strong>
          )}
          {message.content}
        </p>
      </button>
      <button
        type="button"
        aria-label={`关闭并标记已读：${message.title || '消息'}`}
        className="-mr-1 -mt-0.5 flex min-h-7 min-w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-primary/8 hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
        onClick={() => onRead(message.id)}
      >
        <X size={15} aria-hidden="true" />
      </button>
    </div>
  )
}

export function MessageToasts({
  messages,
  onRead,
  theme,
  account,
}: {
  messages: PushMessage[]
  onRead: (id: string) => void
  theme: ResolvedTheme
  account: string
}) {
  const visible = useRef(new Set<string>())
  const [selected, setSelected] = useState<PushMessage | null>(null)
  useEffect(() => {
    const current = visible.current
    const next = new Set(messages.map((message) => `push:${account}:${message.id}`))
    for (const id of current)
      if (!next.has(id)) {
        toast.dismiss(id)
        current.delete(id)
      }
    for (const message of messages) {
      const id = `push:${account}:${message.id}`
      if (current.has(id)) continue
      current.add(id)
      toast(
        <MessagePreview
          message={message}
          onRead={onRead}
          onOpen={(item) => {
            setSelected(item)
            onRead(item.id)
          }}
        />,
        {
          id,
          toasterId: 'push-messages',
          duration: Infinity,
          dismissible: false,
          closeButton: false,
          className: 'blank-toast push-toast',
        },
      )
    }
  }, [messages, onRead, account])
  useEffect(() => {
    const current = visible.current
    return () => {
      for (const id of current) toast.dismiss(id)
      current.clear()
    }
  }, [])
  return (
    <>
      <Toaster
        id="push-messages"
        position="top-right"
        theme={theme}
        expand={false}
        visibleToasts={3}
        duration={Infinity}
        containerAriaLabel="推送消息"
        closeButton={false}
        hotkey={['altKey', 'KeyM']}
        style={{ zIndex: 40 }}
      />
      <NativeDialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
        title={selected?.title || '消息'}
      >
        <div className="min-h-0 overflow-y-auto overscroll-contain whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere]">
          {selected?.content}
        </div>
      </NativeDialog>
    </>
  )
}

export function PushNotifications({
  connection,
  theme,
}: {
  connection: CloudConnection | null
  theme: ResolvedTheme
}) {
  const { messages, markRead } = usePushMessages(connection)
  if (!connection) return null
  return (
    <MessageToasts
      key={connection.session.user.githubId}
      account={connection.session.user.githubId}
      messages={messages}
      onRead={markRead}
      theme={theme}
    />
  )
}
