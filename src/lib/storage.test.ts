import 'fake-indexeddb/auto'
import { afterAll, expect, it, vi } from 'vitest'
import { acknowledgeCloudUpload, loadCloudUpload, loadWorkspace, saveWorkspace } from './storage'
import { createWorkspace } from './workspace'

// IndexedDB is exercised through its normal transaction API; only the DOM event target is supplied.
vi.stubGlobal('window', new EventTarget())
afterAll(() => vi.unstubAllGlobals())

it('本机保存和待上传内容一起持久化，重新读取时保留原请求标识', async () => {
  const workspace = createWorkspace()
  const target = 'persistence-test'
  await saveWorkspace(workspace, target)
  expect(await loadWorkspace()).toEqual(workspace)
  const queued = await loadCloudUpload(target)
  expect(queued.pending?.workspace).toEqual(workspace)
  expect((await loadCloudUpload(target)).pending?.id).toBe(queued.pending?.id)
})

it('普通初始化保存不上传，不同服务器或账号的队列独立', async () => {
  const workspace = createWorkspace()
  await saveWorkspace(workspace)
  expect(await loadCloudUpload('untouched-account')).toEqual({
    pending: null,
    manual: [],
    lastUpload: null,
  })
  await saveWorkspace(workspace, 'first-account')
  const first = await loadCloudUpload('first-account')
  const changed = { ...workspace, todos: [] }
  await saveWorkspace(changed, 'second-account')
  expect(await loadCloudUpload('first-account')).toEqual(first)
  expect((await loadCloudUpload('second-account')).pending?.workspace.todos).toEqual([])
})

it('旧上传完成不会清除之后的修改，新上传完成后才清空待上传状态', async () => {
  const target = 'newer-edit-test'
  const workspace = createWorkspace()
  await saveWorkspace(workspace, target)
  const first = (await loadCloudUpload(target)).pending!
  await saveWorkspace({ ...workspace, todos: [] }, target)
  const second = (await loadCloudUpload(target)).pending!
  const backup = {
    id: 'saved-first',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    bytes: 100,
    todos: 2,
    notes: 2,
    sites: 9,
  }
  await acknowledgeCloudUpload(target, first, backup)
  expect((await loadCloudUpload(target)).pending?.id).toBe(second.id)
  expect((await loadCloudUpload(target)).lastUpload).toEqual(backup)
  await acknowledgeCloudUpload(target, second, { ...backup, id: 'saved-second', todos: 0 })
  expect((await loadCloudUpload(target)).pending).toBeNull()
})

it('设备标识跨队列保持一致，手动快照不会被后续自动编辑替换', async () => {
  const workspace = createWorkspace()
  await saveWorkspace(workspace, 'manual-queue', 'manual')
  const first = await loadCloudUpload('manual-queue')
  expect(first.manual).toHaveLength(1)
  expect(first.pending).toBeNull()
  expect(first.manual[0].mode).toBe('manual')
  const deviceId = first.manual[0].deviceId
  expect(deviceId).toMatch(/^[\da-f-]{36}$/)
  await saveWorkspace({ ...workspace, todos: [] }, 'manual-queue')
  const edited = await loadCloudUpload('manual-queue')
  expect(edited.manual).toEqual(first.manual)
  expect(edited.pending?.mode).toBe('automatic')
  expect(edited.pending?.deviceId).toBe(deviceId)
  await saveWorkspace(workspace, 'other-destination')
  expect((await loadCloudUpload('other-destination')).pending?.deviceId).toBe(deviceId)
})
