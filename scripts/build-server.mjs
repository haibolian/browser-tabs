import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { isBuiltin } from 'node:module'
import { resolve } from 'node:path'
import { build } from 'esbuild'

const root = resolve(import.meta.dirname, '..')
const manifest = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
const result = await build({
  absWorkingDir: root,
  entryPoints: ['server/index.ts'],
  outfile: 'server-dist/index.mjs',
  bundle: true,
  packages: 'external',
  platform: 'node',
  target: 'node24',
  format: 'esm',
  metafile: true,
})

assert.ok(
  Object.keys(result.metafile.inputs).every(
    (path) => !path.split(/[\\/]/).includes('node_modules'),
  ),
  'Third-party dependencies must be installed separately, not bundled into the server',
)
for (const output of Object.values(result.metafile.outputs)) {
  for (const dependency of output.imports) {
    const packageName = dependency.path.startsWith('@')
      ? dependency.path.split('/').slice(0, 2).join('/')
      : dependency.path.split('/')[0]
    assert.ok(
      isBuiltin(dependency.path) || manifest.dependencies[packageName],
      `Missing production dependency: ${dependency.path}`,
    )
  }
}

const archive = 'browser-tabs-server.tar.gz'
execFileSync(
  'tar',
  [
    '-czf',
    archive,
    'server-dist/index.mjs',
    'package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    'deploy',
    'docs/deploy-debian12.md',
    'docs/github-actions.md',
    'docs/push-messages.md',
  ],
  { cwd: root, stdio: 'inherit' },
)
console.log(`Server build: ${resolve(root, 'server-dist/index.mjs')}`)
console.log(`Deployment package: ${resolve(root, archive)}`)
