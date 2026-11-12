import assert from 'node:assert/strict'
import { createHash, createPublicKey } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parseEnv } from 'node:util'
import { unzipSync, strFromU8 } from 'fflate'

const root = resolve(import.meta.dirname, '..')
const manifest = JSON.parse(await readFile(resolve(root, 'dist/manifest.json'), 'utf8'))
assert.equal(manifest.manifest_version, 3)
const publicKey = createPublicKey({
  key: Buffer.from(manifest.key, 'base64'),
  format: 'der',
  type: 'spki',
})
assert.equal(publicKey.asymmetricKeyType, 'rsa')
const extensionId = [
  ...createHash('sha256').update(Buffer.from(manifest.key, 'base64')).digest('hex').slice(0, 32),
]
  .map((character) => String.fromCharCode(97 + Number.parseInt(character, 16)))
  .join('')
assert.equal(
  extensionId,
  'nplbljhenhbjjccehgckeanlbiknanoe',
  'Local extension identity must remain stable',
)
const serverExample = parseEnv(await readFile(resolve(root, '.env.server.example'), 'utf8'))
assert.ok(
  serverExample.GITHUB_RETURN_URLS.split(',').includes(
    `https://${extensionId}.chromiumapp.org/github`,
  ),
  'Server configuration must allow the packaged extension callback',
)
assert.equal(manifest.chrome_url_overrides.newtab, 'index.html')
assert.equal(
  manifest.content_security_policy.extension_pages,
  "script-src 'self'; object-src 'self'; base-uri 'self'",
)
assert.deepEqual(
  manifest.permissions,
  ['identity'],
  'Only identity is needed for the GitHub OAuth window',
)
assert.ok(!manifest.host_permissions?.length, 'No host access is needed')
assert.deepEqual(manifest.optional_host_permissions, ['http://*/*', 'https://*/*'])
assert.equal(manifest.background.service_worker, 'background.js')
assert.equal(manifest.background.type, 'module')
const html = await readFile(resolve(root, 'dist/index.html'), 'utf8')
const scripts = [...html.matchAll(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/g)].map(
  (match) => match[1],
)
assert.ok(scripts.length > 0)
assert.equal(scripts[0], './theme-init.js', 'Theme must initialize before React to avoid flashing')
assert.ok(!/<script[^>]*>\s*[^<\s]/.test(html), 'MV3 does not permit inline scripts')
for (const script of scripts) {
  assert.ok(
    script.startsWith('./assets/') || script === './theme-init.js',
    'Scripts must be bundled locally',
  )
  assert.ok((await stat(resolve(root, 'dist', script))).size > 0)
}
const zip = unzipSync(await readFile(resolve(root, `blank-new-tab-${manifest.version}.zip`)))
assert.deepEqual(JSON.parse(strFromU8(zip['manifest.json'])), manifest)
assert.ok(zip['index.html'])
assert.ok(zip['background.js'])
assert.ok(zip['theme-init.js'])
for (const icon of Object.values(manifest.icons))
  assert.ok(zip[icon]?.length > 0, `Missing icon: ${icon}`)
console.log(
  `Verified Manifest V3 new-tab package: ${Object.keys(zip).length} files, local assets, per-site optional metadata access.`,
)
