import { createHash, randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import type { Backup } from '../src/lib/backup'
import { cloudBackupSchema, type BackupUpload, type CloudBackup } from '../src/lib/cloud-contract'
import { ApiError } from './errors'

export type BackupPolicy = { limit: number; mergeMinutes: number }
export const defaultBackupPolicy: BackupPolicy = { limit: 20, mergeMinutes: 10 }

export function backupRequestHash(payload: string, upload: BackupUpload) {
  return createHash('sha256')
    .update(JSON.stringify([payload, upload.mode, upload.deviceId ?? null]))
    .digest('hex')
}

const metadataColumns =
  'id, created_at AS createdAt, updated_at AS updatedAt, bytes, todos, notes, sites'

export class BackupStore {
  private db: DatabaseSync
  private policy: BackupPolicy
  constructor(db: DatabaseSync, policy: BackupPolicy) {
    this.db = db
    this.policy = policy
  }

  applyRetention() {
    this.db
      .prepare(
        `DELETE FROM backups WHERE id IN (
      SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY updated_at DESC, rowid DESC) AS ordinal
        FROM backups
      ) WHERE ordinal > ?
    )`,
      )
      .run(this.policy.limit)
  }

  save(
    userId: string,
    backup: Backup,
    requestId: string | null,
    upload: BackupUpload,
  ): CloudBackup {
    const payload = JSON.stringify(backup)
    const fingerprint = backupRequestHash(payload, upload)
    this.db.exec('BEGIN IMMEDIATE')
    try {
      if (requestId) {
        const receipt = this.db
          .prepare(
            `SELECT backup_id, payload_hash FROM backup_uploads
          WHERE user_id = ? AND request_id = ?`,
          )
          .get(userId, requestId)
        if (receipt) {
          if (receipt.payload_hash !== fingerprint)
            throw new ApiError(409, '同一上传请求的内容不一致，请重新发起上传')
          const saved = cloudBackupSchema.parse(
            this.db
              .prepare(
                `SELECT ${metadataColumns} FROM backups
            WHERE user_id = ? AND id = ?`,
              )
              .get(userId, receipt.backup_id!),
          )
          this.db.exec('COMMIT')
          return saved
        }
      }

      const now = Date.now()
      const merge =
        upload.mode === 'automatic' && this.policy.mergeMinutes > 0
          ? this.db
              .prepare(
                `SELECT id, created_at FROM backups
            WHERE user_id = ? AND device_id = ? AND mode = 'automatic' AND created_at > ?
            ORDER BY created_at DESC, rowid DESC LIMIT 1`,
              )
              .get(userId, upload.deviceId!, now - this.policy.mergeMinutes * 60_000)
          : undefined
      const metadata: CloudBackup = {
        id: merge ? (merge.id as string) : randomUUID(),
        createdAt: merge ? (merge.created_at as number) : now,
        updatedAt: now,
        bytes: Buffer.byteLength(payload),
        todos: backup.workspace.todos.length,
        notes: backup.workspace.notes.length,
        sites: backup.workspace.items.reduce(
          (count, item) => count + (item.kind === 'folder' ? item.items.length : 1),
          0,
        ),
      }
      if (merge) {
        this.db
          .prepare(
            `UPDATE backups SET payload = ?, updated_at = ?, bytes = ?, todos = ?, notes = ?, sites = ?
          WHERE user_id = ? AND id = ?`,
          )
          .run(
            payload,
            now,
            metadata.bytes,
            metadata.todos,
            metadata.notes,
            metadata.sites,
            userId,
            metadata.id,
          )
      } else {
        this.db
          .prepare(
            `INSERT INTO backups (id, user_id, created_at, updated_at, payload, bytes, todos, notes, sites, device_id, mode)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            metadata.id,
            userId,
            now,
            now,
            payload,
            metadata.bytes,
            metadata.todos,
            metadata.notes,
            metadata.sites,
            upload.deviceId ?? null,
            upload.mode,
          )
      }
      if (requestId)
        this.db
          .prepare('INSERT INTO backup_uploads VALUES (?, ?, ?, ?)')
          .run(userId, requestId, metadata.id, fingerprint)
      // Save and prune in one transaction so a failed upload cannot remove existing history.
      this.db
        .prepare(
          `DELETE FROM backups WHERE user_id = ? AND id NOT IN (
        SELECT id FROM backups WHERE user_id = ? ORDER BY (id = ?) DESC, updated_at DESC, rowid DESC LIMIT ?
      )`,
        )
        .run(userId, userId, metadata.id, this.policy.limit)
      this.db.exec('COMMIT')
      return metadata
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }

  list(userId: string): CloudBackup[] {
    return this.db
      .prepare(
        `SELECT ${metadataColumns} FROM backups
      WHERE user_id = ? ORDER BY updated_at DESC, rowid DESC`,
      )
      .all(userId) as CloudBackup[]
  }

  readBackup(userId: string, id: string): unknown {
    const row = this.db
      .prepare('SELECT payload FROM backups WHERE user_id = ? AND id = ?')
      .get(userId, id)
    if (!row) throw new ApiError(404, '备份不存在')
    return JSON.parse(row.payload as string)
  }

  delete(userId: string, id: string) {
    const result = this.db
      .prepare('DELETE FROM backups WHERE user_id = ? AND id = ?')
      .run(userId, id)
    if (!result.changes) throw new ApiError(404, '备份不存在')
  }
}
