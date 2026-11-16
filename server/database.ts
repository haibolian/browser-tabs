import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import type { Backup } from '../src/lib/backup'
import type { BackupUpload, CloudUser, GitHubIdentity } from '../src/lib/cloud-contract'
import { ApiError } from './errors'
import { migrateDatabase } from './migrations'
import { BackupStore, defaultBackupPolicy, type BackupPolicy } from './backups'

type OAuthRequest = { returnUrl: string; codeChallenge: string }

export class Store {
  private db: DatabaseSync
  private backups: BackupStore

  constructor(path: string, policy: BackupPolicy = defaultBackupPolicy) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
    this.db = new DatabaseSync(path)
    this.db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;')
    try {
      migrateDatabase(this.db, path)
      this.backups = new BackupStore(this.db, policy)
      this.backups.applyRetention()
    } catch (error) {
      this.db.close()
      throw error
    }
  }

  close() {
    this.db.close()
  }

  signIn(identity: GitHubIdentity, tokenHash: string, expiresAt: number): CloudUser {
    this.db.exec('BEGIN IMMEDIATE')
    try {
      const user = this.db
        .prepare(
          `INSERT INTO users VALUES (?, ?, ?, ?)
        ON CONFLICT(github_id) DO UPDATE SET login = excluded.login
        RETURNING id, github_id AS githubId, login`,
        )
        .get(randomUUID(), identity.githubId, identity.login, Date.now()) as CloudUser
      this.db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now())
      this.db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(tokenHash, user.id, expiresAt)
      this.db.exec('COMMIT')
      return user
    } catch (error) {
      if (this.db.isTransaction) this.db.exec('ROLLBACK')
      throw error
    }
  }

  createOAuthRequest(stateHash: string, returnUrl: string, codeChallenge: string) {
    this.db.prepare('DELETE FROM oauth_requests WHERE expires_at <= ?').run(Date.now())
    this.db
      .prepare('INSERT INTO oauth_requests VALUES (?, ?, ?, ?)')
      .run(stateHash, returnUrl, codeChallenge, Date.now() + 10 * 60_000)
  }

  oauthRequest(stateHash: string): OAuthRequest {
    const request = this.db
      .prepare(
        `SELECT return_url AS returnUrl, code_challenge AS codeChallenge
      FROM oauth_requests WHERE state_hash = ? AND expires_at > ?`,
      )
      .get(stateHash, Date.now())
    if (!request) throw new ApiError(400, '登录请求已过期或无效，请重新使用 GitHub 登录')
    return request as OAuthRequest
  }

  consumeOAuthRequest(stateHash: string, codeChallenge: string) {
    const result = this.db
      .prepare(
        `DELETE FROM oauth_requests
      WHERE state_hash = ? AND code_challenge = ? AND expires_at > ?`,
      )
      .run(stateHash, codeChallenge, Date.now())
    if (!result.changes) throw new ApiError(400, '登录请求无效、已使用或校验不匹配，请重新登录')
  }

  sessionUser(tokenHash: string) {
    return this.db
      .prepare(
        `SELECT users.id, users.github_id AS githubId, users.login FROM sessions
        JOIN users ON users.id = sessions.user_id
        WHERE token_hash = ? AND expires_at > ?`,
      )
      .get(tokenHash, Date.now()) as CloudUser | undefined
  }

  logout(tokenHash: string) {
    this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash)
  }

  saveBackup(
    userId: string,
    backup: Backup,
    requestId: string | null = null,
    upload: BackupUpload = { mode: 'manual' },
  ) {
    return this.backups.save(userId, backup, requestId, upload)
  }

  listBackups(userId: string) {
    return this.backups.list(userId)
  }

  readBackup(userId: string, id: string) {
    return this.backups.readBackup(userId, id)
  }

  deleteBackup(userId: string, id: string) {
    this.backups.delete(userId, id)
  }
}
