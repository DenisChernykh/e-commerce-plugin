import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

async function files(directory: string): Promise<string[]> {
  return (
    await Promise.all(
      (await readdir(directory, { withFileTypes: true })).map((entry) => {
        const target = join(directory, entry.name)
        return entry.isDirectory() ? files(target) : [target]
      }),
    )
  ).flat()
}
async function digest() {
  const hash = createHash('sha256')
  for (const file of [
    'openapi/openapi.json',
    ...(await files('src/shared/api/generated')),
  ].sort()) {
    hash.update(file).update(await readFile(file))
  }
  return hash.digest('hex')
}
const before = await digest()
const result = spawnSync('pnpm', ['api:update'], { stdio: 'inherit' })
if (result.status !== 0) process.exit(result.status ?? 1)
if (before !== (await digest()))
  throw new Error(
    'OpenAPI artifacts were stale; regenerated files are left for review',
  )
console.log('OpenAPI snapshot and client match backend source')
