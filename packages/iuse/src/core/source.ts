import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { CommandRunner } from '@infra-ai/meta-cli/core'

export interface SourceRef {
  root: string
  version: { type: 'local' | 'remote'; id: string }
  locator: string
}

type DownloadFn = (input: string, opts: { dir: string; forceClean?: boolean }) => Promise<unknown>

function assertSourceRoot(root: string, locator: string): void {
  if (!existsSync(join(root, 'profiles.json'))) {
    throw new Error(`profiles.json not found in source '${locator}' -- not an infra-ai source`)
  }
}

async function localRef(root: string, locator: string, run: CommandRunner): Promise<SourceRef> {
  assertSourceRoot(root, locator)
  const head = await run('git', ['rev-parse', 'HEAD'], { cwd: root })
  let id = head.code === 0 ? head.stdout.trim() : 'no-git'
  if (head.code === 0) {
    const porcelain = await run('git', ['status', '--porcelain'], { cwd: root })
    if (porcelain.code === 0 && porcelain.stdout.trim() !== '') id = `${id}-dirty`
  }
  return { root, version: { type: 'local', id }, locator }
}

async function remoteRef(locator: string, cacheDir: string, download: DownloadFn): Promise<SourceRef> {
  const refPart = locator.includes('#') ? locator.slice(locator.indexOf('#') + 1) : 'main'
  const safe = locator.replaceAll(/[^A-Za-z0-9._-]/gu, '-')
  const dir = join(cacheDir, safe)
  await download(locator, { dir, forceClean: true })
  assertSourceRoot(dir, locator)
  return { root: dir, version: { type: 'remote', id: refPart }, locator }
}

export async function resolveSource(opts: {
  explicit?: string
  envRoot?: string
  homeDefault: string
  cacheDir: string
  download: DownloadFn
  run: CommandRunner
}): Promise<SourceRef> {
  const candidate = opts.explicit ?? opts.envRoot ?? opts.homeDefault
  if (candidate.startsWith('gh:')) return remoteRef(candidate, opts.cacheDir, opts.download)
  return localRef(candidate, candidate, opts.run)
}
