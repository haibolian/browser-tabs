import { DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BackupStore, defaultBackupPolicy } from './backups'
import { migrateDatabase } from './migrations'
import { createWorkspace } from '../src/lib/workspace'
import type { Backup } from '../src/lib/backup'

function backup(content: string): Backup {
  const workspace = createWorkspace()
  workspace.notes[0].content = content
  return { format: 'blank-backup', version: 1, workspace, image: null }
}

describe('备份合并与保留', () => {
  let db: DatabaseSync
  let store: BackupStore
  let now: number
  const deviceA = randomUUID()
  const deviceB = randomUUID()
  const automatic = { mode: 'automatic' as const, deviceId: deviceA }
  beforeEach(() => {
    now = 1_800_000_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    db = new DatabaseSync(':memory:')
    db.exec('PRAGMA foreign_keys = ON')
    migrateDatabase(db, ':memory:')
    db.prepare('INSERT INTO users VALUES (?, ?, ?, ?)').run('alice', '101', 'alice', now)
    db.prepare('INSERT INTO users VALUES (?, ?, ?, ?)').run('bob', '202', 'bob', now)
    store = new BackupStore(db, defaultBackupPolicy)
  })
  afterEach(() => {
    db.close()
    vi.restoreAllMocks()
  })

  it('同设备十分钟内更新同一份，十分钟边界后新增且窗口不随修改延长', () => {
    const first = store.save('alice', backup('first'), randomUUID(), automatic)
    now += 9 * 60_000
    const latest = backup('latest')
    const merged = store.save('alice', latest, randomUUID(), automatic)
    expect(merged).toMatchObject({ id: first.id, createdAt: first.createdAt, updatedAt: now })
    expect(store.readBackup('alice', first.id)).toEqual(latest)
    now += 60_000
    const next = store.save('alice', backup('next-window'), randomUUID(), automatic)
    expect(next.id).not.toBe(first.id)
    expect(store.list('alice')).toHaveLength(2)
  })

  it('手动备份单独保留，不同设备和账号分别合并', () => {
    const first = store.save('alice', backup('auto'), randomUUID(), automatic)
    now++
    const manual = store.save('alice', backup('manual'), randomUUID(), {
      mode: 'manual',
      deviceId: deviceA,
    })
    now++
    expect(store.save('alice', backup('auto-latest'), randomUUID(), automatic).id).toBe(first.id)
    const otherDevice = store.save('alice', backup('device-b'), randomUUID(), {
      ...automatic,
      deviceId: deviceB,
    })
    expect(otherDevice.id).not.toBe(first.id)
    expect(store.list('alice')).toHaveLength(3)
    expect((store.readBackup('alice', manual.id) as Backup).workspace.notes[0].content).toBe(
      'manual',
    )
    expect(store.save('bob', backup('bob'), randomUUID(), automatic).id).not.toBe(first.id)
    expect(store.list('bob')).toHaveLength(1)
  })

  it('每个账号总共只留 20 份，成功保存后清理最旧备份及其请求记录', () => {
    const first = store.save('alice', backup('oldest'), randomUUID(), { mode: 'manual' })
    store.save('bob', backup('bob'), randomUUID(), { mode: 'manual' })
    for (let index = 0; index < 25; index++) {
      now++
      store.save('alice', backup(String(index)), randomUUID(), { mode: 'manual' })
    }
    expect(store.list('alice')).toHaveLength(20)
    expect(store.list('bob')).toHaveLength(1)
    expect(() => store.readBackup('alice', first.id)).toThrow('备份不存在')
    expect(
      db.prepare('SELECT COUNT(*) AS count FROM backup_uploads WHERE user_id = ?').get('alice')!
        .count,
    ).toBe(20)
  })

  it('合并后重试早先请求不增加记录，也不会用旧内容覆盖新内容', () => {
    const firstBody = backup('old')
    const requestId = randomUUID()
    const first = store.save('alice', firstBody, requestId, automatic)
    now += 1000
    const latest = backup('new')
    store.save('alice', latest, randomUUID(), automatic)
    expect(store.save('alice', firstBody, requestId, automatic).id).toBe(first.id)
    expect(store.readBackup('alice', first.id)).toEqual(latest)
    expect(store.list('alice')).toHaveLength(1)
    expect(() => store.save('alice', latest, requestId, automatic)).toThrow('内容不一致')
    expect(() => store.save('alice', firstBody, requestId, { mode: 'manual' })).toThrow(
      '内容不一致',
    )
  })

  it('清理失败时回滚新备份，保留现有历史', () => {
    store = new BackupStore(db, { limit: 1, mergeMinutes: 10 })
    const first = store.save('alice', backup('first'), randomUUID(), { mode: 'manual' })
    db.exec(
      `CREATE TRIGGER fail_cleanup BEFORE DELETE ON backups BEGIN SELECT RAISE(ABORT, 'cleanup failed'); END;`,
    )
    now++
    expect(() => store.save('alice', backup('second'), randomUUID(), { mode: 'manual' })).toThrow(
      'cleanup failed',
    )
    expect(store.list('alice')).toEqual([first])
  })

  it('启动时应用新上限，按账号保留最近的备份', () => {
    const previous = new BackupStore(db, { limit: 100, mergeMinutes: 10 })
    for (let index = 0; index < 25; index++) {
      now++
      previous.save('alice', backup(String(index)), randomUUID(), { mode: 'manual' })
      previous.save('bob', backup(String(index)), randomUUID(), { mode: 'manual' })
    }
    const expected = previous.list('alice').slice(0, 20)
    store.applyRetention()
    expect(store.list('alice')).toEqual(expected)
    expect(store.list('bob')).toHaveLength(20)
  })

  it('可调整数量和合并间隔，合并更新的备份按最新修改时间参与保留', () => {
    store = new BackupStore(db, { limit: 2, mergeMinutes: 1 })
    const first = store.save('alice', backup('auto'), randomUUID(), automatic)
    now++
    const oldest = store.save('alice', backup('manual-old'), randomUUID(), { mode: 'manual' })
    now++
    store.save('alice', backup('auto-updated'), randomUUID(), automatic)
    now++
    store.save('alice', backup('manual-new'), randomUUID(), { mode: 'manual' })
    expect(store.list('alice').map((item) => item.id)).toContain(first.id)
    expect(() => store.readBackup('alice', oldest.id)).toThrow('备份不存在')
    now += 60_000
    expect(store.save('alice', backup('new-window'), randomUUID(), automatic).id).not.toBe(first.id)
  })
})
