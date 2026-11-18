// @vitest-environment jsdom
import { useState } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { MessageToasts } from './push-notifications'
import type { PushMessage } from '@/lib/push-contract'

let overflowing = false
beforeEach(() => {
  overflowing = false
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  )
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
    setTimeout(() => callback(performance.now()), 0),
  )
  vi.stubGlobal('cancelAnimationFrame', clearTimeout)
  window.matchMedia = vi
    .fn()
    .mockReturnValue({ matches: false, addEventListener() {}, removeEventListener() {} })
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.classList.contains('push-message-preview') ? (overflowing ? 80 : 40) : 0
  })
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.classList.contains('push-message-preview') ? 40 : 0
  })
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
    this.querySelector<HTMLButtonElement>('button')?.focus()
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
})
afterEach(() => {
  cleanup()
  toast.dismiss()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const message: PushMessage = {
  id: crypto.randomUUID(),
  title: '日报',
  content: '完整的消息内容',
  createdAt: 100,
  readAt: null,
}
function Harness({
  read,
  items = [message],
}: {
  read: (id: string) => void
  items?: PushMessage[]
}) {
  const [messages, setMessages] = useState(items)
  return (
    <MessageToasts
      account="101"
      theme="light"
      messages={messages}
      onRead={(id) => {
        read(id)
        setMessages((current) => current.filter((item) => item.id !== id))
      }}
    />
  )
}

it('右上角推送不会自动关闭，关闭按钮标记已读且不打开全文', async () => {
  const read = vi.fn()
  render(<Harness read={read} />)
  const close = await screen.findByRole('button', { name: '关闭并标记已读：日报' })
  expect(close.closest('[data-sonner-toaster]')?.getAttribute('data-y-position')).toBe('top')
  expect(close.closest('[data-sonner-toaster]')?.getAttribute('data-x-position')).toBe('right')
  vi.useFakeTimers()
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3_600_000)
  })
  expect(screen.getByRole('button', { name: '关闭并标记已读：日报' })).toBe(close)
  expect(read).not.toHaveBeenCalled()
  fireEvent.click(close)
  expect(read).toHaveBeenCalledExactlyOnceWith(message.id)
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('仅截断消息可点击，打开 dialog 显示完整正文并将原 toast 标记已读', async () => {
  overflowing = true
  const read = vi.fn()
  const full = { ...message, content: '第一行\n第二行\n第三行及完整正文<script>literal</script>' }
  render(<Harness read={read} items={[full]} />)
  const preview = await screen.findByRole('button', { name: '查看完整消息：日报' })
  fireEvent.click(preview)
  const dialog = await screen.findByRole('dialog', { name: '日报' })
  expect(dialog.textContent).toContain(full.content)
  expect(dialog.querySelector('script')).toBeNull()
  expect(read).toHaveBeenCalledExactlyOnceWith(full.id)
  await waitFor(() =>
    expect(toast.getToasts().some((item) => item.id === `push:101:${full.id}`)).toBe(false),
  )
  fireEvent.click(screen.getByRole('button', { name: '关闭弹窗' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

it('未截断的短消息不打开 dialog，卸载或刷新不会擅自标记已读', async () => {
  const read = vi.fn()
  const { unmount } = render(<Harness read={read} />)
  await screen.findByRole('button', { name: '关闭并标记已读：日报' })
  expect(screen.queryByRole('button', { name: '查看完整消息：日报' })).toBeNull()
  unmount()
  expect(read).not.toHaveBeenCalled()
})
