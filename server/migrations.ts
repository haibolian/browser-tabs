import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { backupRequestHash } from './backups'

const schema = `
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    github_id TEXT NOT NULL UNIQUE,
    login TEXT NOT NULL,
    created_at INTEGER NOT NULL
  ) STRICT;
  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  ) STRICT;
  CREATE INDEX sessions_expiry ON sessions(expires_at);
  CREATE TABLE backups (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    payload TEXT NOT NULL,
    bytes INTEGER NOT NULL,
    todos INTEGER NOT NULL,
    notes INTEGER NOT NULL,
    sites INTEGER NOT NULL
  ) STRICT;
  CREATE INDEX backups_owner ON backups(user_id, created_at DESC);
  CREATE TABLE oauth_requests (
    state_hash TEXT PRIMARY KEY,
    return_url TEXT NOT NULL,
    code_challenge TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  ) STRICT;
  CREATE INDEX oauth_expiry ON oauth_requests(expires_at);
`

export function migrateDatabase(db: DatabaseSync, path: string) {
  const version = db.prepare('PRAGMA user_version').get()!.user_version
  if (version === 4) {
    migratePushDatabase(db)
    return
  }
  if (version !== 0 && version !== 1 && version !== 2 && version !== 3)
    throw new Error(`不支持的数据库版本：${version}`)
  db.exec('BEGIN IMMEDIATE')
  try {
    if (version === 1) {
      // Local identities cannot be securely matched to GitHub identities by username.
      // Export their backups before retiring the old accounts and revoking all old sessions.
      const backups = db
        .prepare(
          `SELECT backups.id, username, payload
        FROM backups JOIN users ON users.id = backups.user_id ORDER BY backups.rowid`,
        )
        .all()
      if (backups.length) {
        const directory = join(dirname(path), `legacy-backups-${Date.now()}`)
        mkdirSync(directory, { recursive: true })
        const index = backups.map((backup, position) => {
          const file = `${position + 1}.json`
          writeFileSync(join(directory, file), backup.payload as string, { flag: 'wx' })
          return { file, backupId: backup.id, account: backup.username }
        })
        writeFileSync(join(directory, 'index.json'), JSON.stringify(index, null, 2), { flag: 'wx' })
        console.info(
          `旧账号的 ${backups.length} 份备份已导出到 ${directory}，可在 GitHub 登录后导入并重新上传。`,
        )
      }
      db.exec('DROP TABLE sessions; DROP TABLE backups; DROP TABLE users;')
      console.info('已移除本地账号和旧会话，登录方式已迁移为仅 GitHub。')
    }
    if (version === 0 || version === 1) db.exec(schema)
    if (version !== 3)
      db.exec(`ALTER TABLE backups ADD COLUMN upload_key TEXT;
      CREATE UNIQUE INDEX backups_upload_key ON backups(user_id, upload_key);
    `)
    db.exec(`ALTER TABLE backups ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;
      UPDATE backups SET updated_at = created_at;
      ALTER TABLE backups ADD COLUMN device_id TEXT;
      ALTER TABLE backups ADD COLUMN mode TEXT NOT NULL DEFAULT 'manual' CHECK(mode IN ('manual', 'automatic'));
      CREATE INDEX backups_device ON backups(user_id, device_id, mode, created_at DESC);
      CREATE TABLE backup_uploads (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        request_id TEXT NOT NULL,
        backup_id TEXT NOT NULL REFERENCES backups(id) ON DELETE CASCADE,
        payload_hash TEXT NOT NULL,
        PRIMARY KEY(user_id, request_id)
      ) STRICT;
      CREATE INDEX backup_uploads_backup ON backup_uploads(backup_id);
    `)
    const previousUploads = db
      .prepare('SELECT id, user_id, upload_key, payload FROM backups WHERE upload_key IS NOT NULL')
      .all()
    const insertReceipt = db.prepare('INSERT INTO backup_uploads VALUES (?, ?, ?, ?)')
    for (const row of previousUploads)
      insertReceipt.run(
        row.user_id!,
        row.upload_key!,
        row.id!,
        backupRequestHash(row.payload as string, { mode: 'manual' }),
      )
    db.exec(`DROP INDEX backups_upload_key;
      ALTER TABLE backups DROP COLUMN upload_key;
      PRAGMA user_version = 4;`)
    db.exec('COMMIT')
  } catch (error) {
    if (db.isTransaction) db.exec('ROLLBACK')
    throw error
  }
  migratePushDatabase(db)
}

function migratePushDatabase(db: DatabaseSync) {
  db.exec('BEGIN IMMEDIATE')
  try {
    // Additive tables keep version 4 compatible with application release rollback.
    db.exec(`CREATE TABLE IF NOT EXISTS push_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      suffix TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL,
      last_used_at INTEGER
    ) STRICT;
    CREATE INDEX IF NOT EXISTS push_tokens_owner ON push_tokens(user_id);
    CREATE TABLE IF NOT EXISTS push_messages (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      request_key TEXT,
      payload_hash TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      read_at INTEGER
    ) STRICT;
    CREATE UNIQUE INDEX IF NOT EXISTS push_message_request ON push_messages(user_id, request_key);
    CREATE INDEX IF NOT EXISTS push_messages_owner ON push_messages(user_id, created_at);
    CREATE INDEX IF NOT EXISTS push_messages_unread ON push_messages(user_id, read_at, created_at);`)
    db.exec('COMMIT')
  } catch (error) {
    if (db.isTransaction) db.exec('ROLLBACK')
    throw error
  }
}
