import { openDB } from 'idb'
import { workspaceSchema, type Workspace } from './workspace'

const database = openDB('blank-new-tab', 1, {
  upgrade(db) {
    db.createObjectStore('workspace')
    db.createObjectStore('images')
  },
})

export async function loadWorkspace(): Promise<Workspace | undefined> {
  const value = await (await database).get('workspace', 'current')
  return value === undefined ? undefined : workspaceSchema.parse(value)
}

export async function saveWorkspace(workspace: Workspace) {
  await (await database).put('workspace', workspace, 'current')
}

export async function saveImage(id: string, file: Blob) {
  await (await database).put('images', file, id)
}

export async function loadImage(id: string): Promise<Blob> {
  const image = await (await database).get('images', id)
  if (!(image instanceof Blob)) throw new Error('找不到已保存的壁纸，请在壁纸设置中重新上传')
  return image
}

export async function exportWorkspace(workspace: Workspace) {
  const image = workspace.settings.imageId ? await loadImage(workspace.settings.imageId) : null
  const imageData = image
    ? await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error('读取壁纸失败'))
        reader.readAsDataURL(image)
      })
    : null
  return JSON.stringify(
    { format: 'blank-backup', version: 1, workspace, image: imageData },
    null,
    2,
  )
}

export async function importWorkspace(raw: string): Promise<Workspace> {
  const parsed = JSON.parse(raw)
  if (parsed.format !== 'blank-backup' || parsed.version !== 1)
    throw new Error('这不是有效的留白备份文件')
  const workspace = workspaceSchema.parse(parsed.workspace)
  if (workspace.settings.imageId) {
    if (
      typeof parsed.image !== 'string' ||
      !/^data:image\/(png|jpeg|webp|gif|avif);base64,/.test(parsed.image)
    )
      throw new Error('备份中缺少有效的壁纸图片')
    const image = await (await fetch(parsed.image)).blob()
    const imageId = crypto.randomUUID()
    await saveImage(imageId, image)
    workspace.settings.imageId = imageId
  }
  return workspace
}
