import { afterEach, expect, it, vi } from 'vitest'
import { SaveQueue } from './save-queue'

afterEach(() => vi.useRealTimers())

it('连续编辑合并为最新快照，持续输入也会在最大等待时间内保存', async () => {
  vi.useFakeTimers()
  const write = vi.fn<(value: number) => Promise<void>>().mockResolvedValue(undefined)
  const queue = new SaveQueue(write, vi.fn(), vi.fn())
  for (let i = 0; i < 10; i++) {
    queue.enqueue(i)
    await vi.advanceTimersByTimeAsync(100)
  }
  expect(write).toHaveBeenCalledTimes(1)
  expect(write).toHaveBeenLastCalledWith(9)
  queue.enqueue(10)
  queue.enqueue(11)
  await vi.advanceTimersByTimeAsync(250)
  expect(write).toHaveBeenCalledTimes(2)
  expect(write).toHaveBeenLastCalledWith(11)
})

it('慢写入期间只保留最新修改，离开页面时 flush 等待所有写入完成', async () => {
  vi.useFakeTimers()
  let finish!: () => void
  const write = vi
    .fn<(value: number) => Promise<void>>()
    .mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
    )
    .mockResolvedValue(undefined)
  const saved = vi.fn()
  const queue = new SaveQueue(write, saved, vi.fn())
  queue.enqueue(1)
  await vi.advanceTimersByTimeAsync(250)
  queue.enqueue(2)
  queue.enqueue(3)
  const flushing = queue.flush()
  expect(write).toHaveBeenCalledTimes(1)
  finish()
  await flushing
  expect(write.mock.calls).toEqual([[1], [3]])
  expect(saved.mock.calls).toEqual([[1], [3]])
})

it('失败快照保留供重试，重试前的新编辑替换旧快照', async () => {
  vi.useFakeTimers()
  const write = vi
    .fn<(value: number) => Promise<void>>()
    .mockRejectedValueOnce(new Error('quota'))
    .mockResolvedValue(undefined)
  const failed = vi.fn()
  const queue = new SaveQueue(write, vi.fn(), failed)
  queue.enqueue(1)
  await queue.flush()
  expect(failed).toHaveBeenCalledOnce()
  await queue.flush()
  expect(write.mock.calls).toEqual([[1], [1]])
  write.mockRejectedValueOnce(new Error('disk'))
  queue.enqueue(2)
  await queue.flush()
  queue.enqueue(3)
  await queue.flush()
  expect(write.mock.calls).toEqual([[1], [1], [2], [3]])
})
