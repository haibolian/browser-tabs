import { createHash, randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { createSecret, hashToken } from './auth'
import { ApiError } from './errors'
import { pushMessageSchema, pushTokenSchema, type PushMessageInput } from '../src/lib/push-contract'

const tokenColumns = 'id, name, suffix, created_at AS createdAt, last_used_at AS lastUsedAt'
const messageColumns = 'id, title, content, created_at AS createdAt, read_at AS readAt'

export class PushStore {
  private db: DatabaseSync

  constructor(db: DatabaseSync) {
    this.db = db
  }

  listTokens(userId: string) {
    return this.db
      .prepare(
        `SELECT ${tokenColumns} FROM push_tokens WHERE user_id = ? ORDER BY created_at DESC, rowid DESC`,
      )
      .all(userId)
      .map((row) => pushTokenSchema.parse(row))
  }

  createToken(userId: string, name: string) {
    if (this.listTokens(userId).length >= 10)
      throw new ApiError(409, '最多保留 10 个推送令牌，请先撤销不再使用的令牌')
    const token = `blank_push_${createSecret()}`
    const metadata = {
      id: randomUUID(),
      name,
      suffix: token.slice(-6),
      createdAt: Date.now(),
      lastUsedAt: null,
    }
    this.db
      .prepare(
        'INSERT INTO push_tokens (id, user_id, name, suffix, token_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(metadata.id, userId, name, metadata.suffix, hashToken(token), metadata.createdAt)
    return { ...metadata, token }
  }

  revokeToken(userId: string, id: string) {
    if (
      !this.db.prepare('DELETE FROM push_tokens WHERE user_id = ? AND id = ?').run(userId, id)
        .changes
    )
      throw new ApiError(404, '推送令牌不存在')
  }

  authenticate(tokenHash: string) {
    const row = this.db
      .prepare('SELECT id, user_id AS userId FROM push_tokens WHERE token_hash = ?')
      .get(tokenHash)
    if (!row) throw new ApiError(401, '推送令牌无效或已撤销')
    return row as { id: string; userId: string }
  }

  send(token: { id: string; userId: string }, input: PushMessageInput) {
    const now = Date.now()
    const fingerprint = createHash('sha256')
      .update(JSON.stringify([input.title, input.content]))
      .digest('hex')
    this.db.exec('BEGIN IMMEDIATE')
    try {
      // Recheck inside the transaction so a revoked token cannot finish a queued delivery.
      if (
        !this.db
          .prepare('SELECT id FROM push_tokens WHERE id = ? AND user_id = ?')
          .get(token.id, token.userId)
      )
        throw new ApiError(401, '推送令牌无效或已撤销')
      const previous = input.requestId
        ? this.db
            .prepare(
              `SELECT ${messageColumns}, payload_hash FROM push_messages WHERE user_id = ? AND request_key = ?`,
            )
            .get(token.userId, input.requestId)
        : undefined
      if (previous) {
        if (previous.payload_hash !== fingerprint)
          throw new ApiError(409, '同一请求标识对应的消息内容不一致')
        this.db.exec('COMMIT')
        return pushMessageSchema.parse(previous)
      }
      const recent = this.db
        .prepare('SELECT COUNT(*) AS count FROM push_messages WHERE user_id = ? AND created_at > ?')
        .get(token.userId, now - 60_000)!
      if (Number(recent.count) >= 60) throw new ApiError(429, '推送过于频繁，请稍后重试')
      const unread = this.db
        .prepare(
          'SELECT COUNT(*) AS count FROM push_messages WHERE user_id = ? AND read_at IS NULL',
        )
        .get(token.userId)!
      if (Number(unread.count) >= 200) throw new ApiError(429, '未读消息已达 200 条，请先阅读消息')
      const message = {
        id: randomUUID(),
        title: input.title,
        content: input.content,
        createdAt: now,
        readAt: null,
      }
      this.db
        .prepare(
          'INSERT INTO push_messages (id, user_id, request_key, payload_hash, title, content, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .run(
          message.id,
          token.userId,
          input.requestId ?? null,
          fingerprint,
          input.title,
          input.content,
          now,
        )
      this.db.prepare('UPDATE push_tokens SET last_used_at = ? WHERE id = ?').run(now, token.id)
      this.db
        .prepare('DELETE FROM push_messages WHERE user_id = ? AND read_at < ?')
        .run(token.userId, now - 30 * 86_400_000)
      this.db.exec('COMMIT')
      return message
    } catch (error) {
      if (this.db.isTransaction) this.db.exec('ROLLBACK')
      throw error
    }
  }

  unread(userId: string) {
    return this.db
      .prepare(
        `SELECT ${messageColumns} FROM push_messages WHERE user_id = ? AND read_at IS NULL ORDER BY created_at, rowid LIMIT 200`,
      )
      .all(userId)
      .map((row) => pushMessageSchema.parse(row))
  }

  markRead(userId: string, ids: string[]) {
    const parameters = ids.map(() => '?').join(', ')
    this.db
      .prepare(
        `UPDATE push_messages SET read_at = COALESCE(read_at, ?) WHERE user_id = ? AND id IN (${parameters})`,
      )
      .run(Date.now(), userId, ...ids)
  }
}
