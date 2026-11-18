import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CloudApi, type CloudConnection } from '@/lib/cloud-api'
import type { PushMessage } from '@/lib/push-contract'
import {
  acknowledgePushReads,
  queuePushRead,
  readPushReadState,
  subscribePushReads,
} from '@/lib/push-read-state'

export function usePushMessages(connection: CloudConnection | null) {
  const account = connection?.session.user.githubId ?? null
  const [state, setState] = useState<{ account: string | null; messages: PushMessage[] }>({
    account: null,
    messages: [],
  })
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    if (!connection || !account) return
    const api = new CloudApi(connection.session)
    const controller = new AbortController()
    let running = false
    const refresh = async () => {
      if (running || document.visibilityState === 'hidden' || controller.signal.aborted) return
      running = true
      try {
        const records = readPushReadState(account)
        const pending = Object.keys(records)
          .filter((id) => records[id].pending)
          .slice(0, 200)
        if (pending.length) {
          try {
            await api.readPushMessages(pending, controller.signal)
            if (controller.signal.aborted) return
            acknowledgePushReads(account, pending)
          } catch {
            if (controller.signal.aborted) return
          }
        }
        const messages = await api.listPushMessages(controller.signal)
        if (!controller.signal.aborted) {
          const read = readPushReadState(account)
          setState({ account, messages: messages.filter((message) => !read[message.id]) })
        }
      } catch {
        // Keep current notifications and durable read receipts until the next connection attempt.
      } finally {
        running = false
      }
    }
    const onWake = () => void refresh()
    void refresh()
    const timer = setInterval(onWake, 30_000)
    window.addEventListener('focus', onWake)
    window.addEventListener('online', onWake)
    document.addEventListener('visibilitychange', onWake)
    return () => {
      controller.abort()
      clearInterval(timer)
      window.removeEventListener('focus', onWake)
      window.removeEventListener('online', onWake)
      document.removeEventListener('visibilitychange', onWake)
    }
  }, [connection, account, revision])

  useEffect(() => {
    if (!account) return
    return subscribePushReads(account, () => {
      const records = readPushReadState(account)
      setState((current) =>
        current.account === account
          ? { ...current, messages: current.messages.filter((message) => !records[message.id]) }
          : current,
      )
    })
  }, [account])

  const markRead = useCallback(
    (id: string) => {
      if (!account) return
      try {
        queuePushRead(account, id)
        setRevision((value) => value + 1)
      } catch (error) {
        toast.error(`保存已读状态失败：${(error as Error).message}`)
      }
    },
    [account],
  )

  return { messages: state.account === account ? state.messages : [], markRead }
}
