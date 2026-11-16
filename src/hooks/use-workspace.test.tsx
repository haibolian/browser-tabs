// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useWorkspace } from './use-workspace'
import { createWorkspace } from '@/lib/workspace'
import { loadWorkspace, saveWorkspace } from '@/lib/storage'

vi.mock('@/lib/storage', () => ({ loadWorkspace: vi.fn(), saveWorkspace: vi.fn() }))
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.clearAllMocks()
})

it('初始化不上传；连续修改只写最新快照，保存后移除离开保护', async () => {
  vi.mocked(loadWorkspace).mockResolvedValue(createWorkspace())
  vi.mocked(saveWorkspace).mockResolvedValue(undefined)
  const { result } = renderHook(() => useWorkspace(null))
  await waitFor(() => expect(result.current.workspace).not.toBeNull())
  await waitFor(() => expect(result.current.saving).toBe(false))
  expect(saveWorkspace).toHaveBeenCalledWith(result.current.workspace, undefined)
  vi.mocked(saveWorkspace).mockClear()
  vi.useFakeTimers()
  act(() => result.current.setWorkspace((state) => ({ ...state!, notes: [] })))
  act(() => result.current.setWorkspace((state) => ({ ...state!, todos: [] })))
  expect(result.current.saving).toBe(true)
  await act(async () => {
    await vi.advanceTimersByTimeAsync(250)
  })
  expect(saveWorkspace).toHaveBeenCalledTimes(1)
  expect(saveWorkspace).toHaveBeenCalledWith(
    expect.objectContaining({ notes: [], todos: [] }),
    undefined,
  )
  expect(result.current.saving).toBe(false)
  const leave = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(leave)
  expect(leave.defaultPrevented).toBe(false)
})

it('尚未保存时离开会立即提交最新修改，失败后可重试', async () => {
  vi.mocked(loadWorkspace).mockResolvedValue(createWorkspace())
  vi.mocked(saveWorkspace).mockResolvedValue(undefined)
  const { result } = renderHook(() => useWorkspace(null))
  await waitFor(() => expect(result.current.workspace).not.toBeNull())
  await waitFor(() => expect(result.current.saving).toBe(false))
  vi.useFakeTimers()
  vi.mocked(saveWorkspace).mockRejectedValueOnce(new Error('disk full'))
  act(() => result.current.setWorkspace((state) => ({ ...state!, notes: [] })))
  const leave = new Event('beforeunload', { cancelable: true })
  await act(async () => {
    window.dispatchEvent(leave)
  })
  expect(leave.defaultPrevented).toBe(true)
  expect(result.current.saveError).toContain('disk full')
  expect(result.current.saving).toBe(true)
  await act(async () => {
    result.current.retrySave()
  })
  expect(result.current.saveError).toBeNull()
  expect(result.current.saving).toBe(false)
  expect(saveWorkspace).toHaveBeenLastCalledWith(expect.objectContaining({ notes: [] }), undefined)
})
