// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { CloudApi, type CloudConnection } from '@/lib/cloud-api'
import { CLOUD_SERVER_URL } from '@/lib/cloud-server'
import { readPushReadState, queuePushRead } from '@/lib/push-read-state'
import { usePushMessages } from './use-push-messages'

const connection: CloudConnection = {
  baseUrl: CLOUD_SERVER_URL,
  session: {
    token: 'session',
    expiresAt: Date.now() + 60000,
    user: { id: 'owner', githubId: '101', login: 'alice' },
  },
}
const first = {
  id: crypto.randomUUID(),
  title: '日报',
  content: '结果',
  createdAt: 100,
  readAt: null,
}

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.restoreAllMocks()
})

it('关闭消息立即从页面移除，失败的已读同步保留待重试，唤醒后补交', async () => {
  vi.spyOn(CloudApi.prototype, 'listPushMessages').mockResolvedValue([first])
  const read = vi
    .spyOn(CloudApi.prototype, 'readPushMessages')
    .mockRejectedValue(new Error('offline'))
  const { result } = renderHook(() => usePushMessages(connection))
  await waitFor(() => expect(result.current.messages).toEqual([first]))
  act(() => result.current.markRead(first.id))
  await waitFor(() => expect(read).toHaveBeenCalled())
  expect(result.current.messages).toEqual([])
  expect(readPushReadState('101')[first.id].pending).toBe(true)
  read.mockResolvedValue(undefined)
  await act(async () => {
    window.dispatchEvent(new Event('online'))
  })
  await waitFor(() => expect(readPushReadState('101')[first.id].pending).toBe(false))
  expect(result.current.messages).toEqual([])
})

it('重开标签页时补交待同步已读，不重新显示已经关闭的消息', async () => {
  queuePushRead('101', first.id)
  const second = { ...first, id: crypto.randomUUID(), content: '新消息' }
  vi.spyOn(CloudApi.prototype, 'readPushMessages').mockResolvedValue(undefined)
  vi.spyOn(CloudApi.prototype, 'listPushMessages').mockResolvedValue([first, second])
  const { result } = renderHook(() => usePushMessages(connection))
  await waitFor(() => expect(result.current.messages).toEqual([second]))
  expect(CloudApi.prototype.readPushMessages).toHaveBeenCalledWith(
    [first.id],
    expect.any(AbortSignal),
  )
})

it('退出账号会清除当前可见推送，其他标签页的已读操作立即同步', async () => {
  vi.spyOn(CloudApi.prototype, 'readPushMessages').mockResolvedValue(undefined)
  vi.spyOn(CloudApi.prototype, 'listPushMessages').mockResolvedValue([first])
  const { result, rerender } = renderHook(({ value }) => usePushMessages(value), {
    initialProps: { value: connection as CloudConnection | null },
  })
  await waitFor(() => expect(result.current.messages).toHaveLength(1))
  act(() => queuePushRead('101', first.id))
  expect(result.current.messages).toEqual([])
  rerender({ value: null })
  expect(result.current.messages).toEqual([])
})
