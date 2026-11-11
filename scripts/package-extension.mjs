import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { resolve, relative } from 'node:path'
import sharp from 'sharp'
import { zipSync } from 'fflate'

const root = resolve(import.meta.dirname, '..')
const dist = resolve(root, 'dist')
const icon = await readFile(resolve(root, 'public/favicon.svg'))
await mkdir(resolve(dist, 'icons'), { recursive: true })
for (const size of [16, 32, 48, 128])
  await sharp(icon)
    .resize(size, size)
    .png()
    .toFile(resolve(dist, `icons/icon-${size}.png`))
const manifest = JSON.parse(await readFile(resolve(dist, 'manifest.json'), 'utf8'))
const files = {}
async function collect(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name)
    if (entry.isDirectory()) await collect(path)
    else files[relative(dist, path).replaceAll('\\', '/')] = new Uint8Array(await readFile(path))
  }
}
await collect(dist)
const zip = resolve(root, `blank-new-tab-${manifest.version}.zip`)
await writeFile(zip, zipSync(files, { level: 6 }))
console.log(`Extension ready: ${dist}\nArchive: ${zip}`)
