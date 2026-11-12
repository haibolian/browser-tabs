import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, relative } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { expect, it } from 'vitest'
import { Store } from './database'
import { migrateDatabase } from './migrations'
import { BackupStore, defaultBackupPolicy } from './backups'
import { createWorkspace } from '../src/lib/workspace'

it('移除旧账号及密码字段前导出备份，撤销旧会话，且不按同名自动关联 GitHub', () => {
  const directory = mkdtempSync(join(tmpdir(), 'blank-github-migration-'))
  const path = join(directory, 'blank.sqlite')
  const original = new DatabaseSync(path)
  const backup = JSON.stringify({
    format: 'blank-backup',
    version: 1,
    workspace: createWorkspace(),
    image: null,
  })
  original.exec(`CREATE TABLE users(id TEXT PRIMARY KEY, username TEXT, password_hash TEXT);
    CREATE TABLE sessions(token_hash TEXT, user_id TEXT, expires_at INTEGER);
    CREATE TABLE backups(id TEXT, user_id TEXT, payload TEXT);
    PRAGMA user_version = 1;`)
  original
    .prepare('INSERT INTO users VALUES (?, ?, ?)')
    .run('old-user', 'alice', 'retired-credential')
  original
    .prepare('INSERT INTO sessions VALUES (?, ?, ?)')
    .run('old-session', 'old-user', Date.now() + 60_000)
  original.prepare('INSERT INTO backups VALUES (?, ?, ?)').run('old-backup', 'old-user', backup)
  original.close()
  try {
    const store = new Store(path)
    expect(store.sessionUser('old-session')).toBeUndefined()
    const user = store.signIn(
      { githubId: '101', login: 'alice' },
      'new-session',
      Date.now() + 60_000,
    )
    expect(user.id).not.toBe('old-user')
    expect(store.listBackups(user.id)).toEqual([])
    store.close()
    const inspect = new DatabaseSync(path, { readOnly: true })
    expect(
      inspect
        .prepare('PRAGMA table_info(users)')
        .all()
        .map((column) => column.name),
    ).toEqual(['id', 'github_id', 'login', 'created_at'])
    expect(inspect.prepare('PRAGMA user_version').get()!.user_version).toBe(4)
    inspect.close()
    const exported = readdirSync(directory).find((name) => name.startsWith('legacy-backups-'))!
    expect(readFileSync(join(directory, exported, '1.json'), 'utf8')).toBe(backup)
    expect(JSON.parse(readFileSync(join(directory, exported, 'index.json'), 'utf8'))).toEqual([
      { file: '1.json', backupId: 'old-backup', account: 'alice' },
    ])
  } finally {
    const target = resolve(directory)
    expect(relative(tmpdir(), target)).toMatch(/^blank-github-migration-/)
    rmSync(target, { recursive: true })
  }
})

it('版本 3 升级保留备份、会话与幂等记录，旧备份作为独立快照', () => {
  const db = new DatabaseSync(':memory:')
  try {
    db.exec(`PRAGMA foreign_keys = ON;
      CREATE TABLE users(id TEXT PRIMARY KEY, github_id TEXT, login TEXT, created_at INTEGER);
      CREATE TABLE sessions(token_hash TEXT, user_id TEXT, expires_at INTEGER);
      CREATE TABLE backups(id TEXT PRIMARY KEY, user_id TEXT, created_at INTEGER, payload TEXT, bytes INTEGER, todos INTEGER, notes INTEGER, sites INTEGER, upload_key TEXT);
      CREATE UNIQUE INDEX backups_upload_key ON backups(user_id, upload_key);
      PRAGMA user_version = 3;`)
    const backup = {
      format: 'blank-backup' as const,
      version: 1 as const,
      workspace: createWorkspace(),
      image: null,
    }
    db.prepare('INSERT INTO users VALUES (?, ?, ?, ?)').run('owner', '101', 'alice', 100)
    db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run('session', 'owner', 9000)
    db.prepare('INSERT INTO backups VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      'snapshot',
      'owner',
      1000,
      JSON.stringify(backup),
      100,
      2,
      2,
      9,
      'request',
    )
    migrateDatabase(db, ':memory:')
    const saved = new BackupStore(db, defaultBackupPolicy).save('owner', backup, 'request', {
      mode: 'manual',
    })
    expect(saved).toMatchObject({ id: 'snapshot', createdAt: 1000, updatedAt: 1000 })
    expect(db.prepare('SELECT COUNT(*) AS count FROM backups').get()!.count).toBe(1)
    expect(db.prepare('SELECT mode, device_id FROM backups').get()).toMatchObject({
      mode: 'manual',
      device_id: null,
    })
    expect(db.prepare('SELECT token_hash FROM sessions').get()!.token_hash).toBe('session')
  } finally {
    db.close()
  }
})
