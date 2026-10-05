import { spawnSync } from 'node:child_process'
import { cpSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const frontend = fileURLToPath(new URL('../', import.meta.url))
const snapshot = mkdtempSync(join(tmpdir(), 'tiho-architecture-'))

try {
  for (const entry of [
    'src',
    'package.json',
    'tsconfig.json',
    'steiger.config.ts',
  ]) {
    cpSync(join(frontend, entry), join(snapshot, entry), { recursive: true })
  }
  symlinkSync(
    join(frontend, 'node_modules'),
    join(snapshot, 'node_modules'),
    'dir',
  )
  const result = spawnSync(
    process.execPath,
    [join(frontend, 'node_modules/steiger/dist/cli.mjs'), './src'],
    {
      cwd: snapshot,
      env: { ...process.env, CHOKIDAR_USEPOLLING: '1' },
      encoding: 'utf8',
    },
  )
  process.stdout.write(result.stdout?.replaceAll(snapshot, frontend) ?? '')
  process.stderr.write(result.stderr?.replaceAll(snapshot, frontend) ?? '')
  if (result.error) throw result.error
  process.exitCode = result.status ?? 1
} finally {
  rmSync(snapshot, { recursive: true, force: true })
}
