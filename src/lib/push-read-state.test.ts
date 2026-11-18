// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import {
  acknowledgePushReads,
  pushReadKey,
  queuePushRead,
  readPushReadState,
  subscribePushReads,
} from './push-read-state'

afterEach(() => localStorage.clear())

it('已读记录按账号持久化，确认上传后保留去重记录并移除待同步标记', () => {
  const id = crypto.randomUUID()
  queuePushRead('alice', id)
  expect(readPushReadState('alice')[id].pending).toBe(true)
  expect(readPushReadState('bob')).toEqual({})
  acknowledgePushReads('alice', [id])
  expect(readPushReadState('alice')[id].pending).toBe(false)
})

it('确认一批已读时保留另一标签页刚加入的记录，并通知当前标签页', () => {
  const first = crypto.randomUUID()
  const second = crypto.randomUUID()
  let changes = 0
  const unsubscribe = subscribePushReads('alice', () => changes++)
  queuePushRead('alice', first)
  queuePushRead('bob', crypto.randomUUID())
  queuePushRead('alice', second)
  acknowledgePushReads('alice', [first])
  expect(readPushReadState('alice')[second].pending).toBe(true)
  expect(changes).toBe(3)
  unsubscribe()
})

it('损坏或包含无效消息标识的缓存不会阻止读取新的推送', () => {
  localStorage.setItem(pushReadKey('alice'), '{')
  expect(readPushReadState('alice')).toEqual({})
  localStorage.setItem(pushReadKey('alice'), JSON.stringify({ bad: { at: 1, pending: true } }))
  expect(readPushReadState('alice')).toEqual({})
})
