import { openDB } from 'idb'
import { workspaceSchema, type Settings, type Workspace } from './workspace'
import { importInfinityBackup, type ImportedBackup } from './infinity-backup'
import { backupSchema } from './backup'
import { prepareImage } from './image-processing'
import { cloudBackupSchema, type BackupUpload, type CloudBackup } from './cloud-contract'
import type { CloudUploadJob, CloudUploadRecord } from './cloud-upload'

const database = openDB('blank-new-tab', 2, {
  upgrade(db, oldVersion) {
    if (oldVersion < 1) {
      db.createObjectStore('workspace')
      db.createObjectStore('images')
    }
    if (oldVersion < 2) db.createObjectStore('cloudUploads')
  },
  blocking: () => {
    void database.then((db) => db.close())
  },
})

const uploadEvent = 'blank:cloud-upload-changed'
let uploadChannel: BroadcastChannel | undefined

export function subscribeCloudUploads(listener: () => void) {
  uploadChannel = new BroadcastChannel(uploadEvent)
  uploadChannel.addEventListener('message', listener)
  window.addEventListener(uploadEvent, listener)
  return () => {
    uploadChannel?.close()
    uploadChannel = undefined
    window.removeEventListener(uploadEvent, listener)
  }
}

function notifyCloudUploads() {
  window.dispatchEvent(new Event(uploadEvent))
  uploadChannel?.postMessage(null)
}

export async function loadWorkspace(): Promise<Workspace | undefined> {
  const value = await (await database).get('workspace', 'current')
  return value === undefined ? undefined : workspaceSchema.parse(value)
}

function uploadRecord(record?: CloudUploadRecord): CloudUploadRecord {
  return {
    pending: record?.pending ?? null,
    manual: record?.manual ?? [],
    lastUpload: record?.lastUpload ? cloudBackupSchema.parse(record.lastUpload) : null,
  }
}

export async function saveWorkspace(
  workspace: Workspace,
  cloudTarget?: string,
  mode: BackupUpload['mode'] = 'automatic',
) {
  const db = await database
  const transaction = db.transaction(['workspace', 'cloudUploads'], 'readwrite')
  await transaction.objectStore('workspace').put(workspace, 'current')
  if (cloudTarget) {
    const queue = transaction.objectStore('cloudUploads')
    const previous = uploadRecord(await queue.get(cloudTarget))
    const workspaceStore = transaction.objectStore('workspace')
    let deviceId: string | undefined = await workspaceStore.get('cloud-device-id')
    if (!deviceId) {
      deviceId = crypto.randomUUID()
      await workspaceStore.put(deviceId, 'cloud-device-id')
    }
    const job: CloudUploadJob = {
      id: crypto.randomUUID(),
      workspace,
      changedAt: Date.now(),
      mode,
      deviceId,
    }
    await queue.put(
      {
        pending: mode === 'automatic' ? job : null,
        manual: mode === 'manual' ? [...previous.manual, job] : previous.manual,
        lastUpload: previous.lastUpload,
      } satisfies CloudUploadRecord,
      cloudTarget,
    )
  }
  await transaction.done
  if (cloudTarget) notifyCloudUploads()
}

export async function loadCloudUpload(target: string): Promise<CloudUploadRecord> {
  return uploadRecord(await (await database).get('cloudUploads', target))
}

export async function acknowledgeCloudUpload(
  target: string,
  job: CloudUploadJob,
  backup: CloudBackup,
) {
  const transaction = (await database).transaction('cloudUploads', 'readwrite')
  const record = uploadRecord(await transaction.store.get(target))
  await transaction.store.put(
    {
      pending: record.pending?.id === job.id ? null : record.pending,
      manual: record.manual.filter((queued) => queued.id !== job.id),
      lastUpload: backup,
    } satisfies CloudUploadRecord,
    target,
  )
  await transaction.done
  notifyCloudUploads()
}

export async function saveImage(id: string, file: Blob, brightness?: number) {
  const transaction = (await database).transaction('images', 'readwrite')
  await transaction.store.put(file, id)
  if (brightness !== undefined) await transaction.store.put(brightness, `${id}:brightness`)
  else await transaction.store.delete(`${id}:brightness`)
  await transaction.done
}

export async function loadWallpaperImage(id: string) {
  const blob = await loadImage(id)
  const cached = await (await database).get('images', `${id}:brightness`)
  if (typeof cached === 'number') return { blob, brightness: cached }
  const { brightness } = await prepareImage(blob, Infinity, Infinity)
  await (await database).put('images', brightness, `${id}:brightness`)
  return { blob, brightness }
}

export async function loadImage(id: string): Promise<Blob> {
  const image = await (await database).get('images', id)
  if (!(image instanceof Blob)) throw new Error('找不到已保存的壁纸，请在壁纸设置中重新上传')
  return image
}

export async function createWorkspaceBackup(workspace: Workspace) {
  const image = workspace.settings.imageId ? await loadImage(workspace.settings.imageId) : null
  const imageData = image
    ? await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error('读取壁纸失败'))
        reader.readAsDataURL(image)
      })
    : null
  return backupSchema.parse({ format: 'blank-backup', version: 1, workspace, image: imageData })
}

export async function exportWorkspace(workspace: Workspace) {
  return JSON.stringify(await createWorkspaceBackup(workspace), null, 2)
}

export async function importWorkspace(raw: string, settings?: Settings): Promise<ImportedBackup> {
  const parsed = JSON.parse(raw)
  if (parsed?.version === 'v2' && parsed?.data?.site) {
    return importInfinityBackup(parsed, settings)
  }
  if (parsed?.format !== 'blank-backup' || parsed?.version !== 1)
    throw new Error('请选择有效的留白或 Infinity v2 备份文件')
  const backup = backupSchema.parse(parsed)
  const workspace = backup.workspace
  if (workspace.settings.imageId) {
    const image = await (await fetch(backup.image!)).blob()
    const imageId = crypto.randomUUID()
    await saveImage(imageId, image)
    workspace.settings.imageId = imageId
  }
  return { workspace, source: 'blank', notices: [] }
}
