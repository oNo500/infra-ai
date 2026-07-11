import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import matter from 'gray-matter'

export type AssetKind = 'rule' | 'skill' | 'template'
export type MetaStatus = 'stub' | 'ready'

export interface MetaAsset {
  name: string
  kind: AssetKind
  status: MetaStatus
  scope: string | null
  metaPath: string
  artifactPath: string
}

const KIND_DIR: Record<AssetKind, string> = {
  rule: 'rules',
  skill: 'skills',
  template: 'templates',
}

const KIND_ORDER: AssetKind[] = ['rule', 'skill', 'template']

export function artifactPathFor(kind: AssetKind, name: string, scope: string | null): string {
  if (kind === 'rule') {
    const sub = scope !== null && scope !== 'global' ? 'scoped' : 'global'
    return `rules/${sub}/${name}.md`
  }
  if (kind === 'skill') return `skills/${name}/SKILL.md`
  return `templates/${name}.md`
}

const NAME_PATTERN = /^[a-z0-9][a-z0-9._-]*$/u

export function parseMetaFile(content: string, filename: string, kind: AssetKind): MetaAsset {
  const { data } = matter(content)
  const stem = filename.replace(/\.md$/u, '')
  const frontmatterName = typeof data.name === 'string' ? data.name : null
  const name = frontmatterName !== null && NAME_PATTERN.test(frontmatterName) ? frontmatterName : stem
  if (!NAME_PATTERN.test(name)) {
    throw new Error(`${filename}: invalid asset name '${name}'`)
  }
  const status: MetaStatus = data.status === 'ready' ? 'ready' : 'stub'
  const scope = kind === 'rule' && typeof data.scope === 'string' ? data.scope : null
  return {
    name,
    kind,
    status,
    scope,
    metaPath: `meta/${KIND_DIR[kind]}/${filename}`,
    artifactPath: artifactPathFor(kind, name, scope),
  }
}

export function discoverAssets(repoRoot: string): MetaAsset[] {
  const assets: MetaAsset[] = []
  const seen = new Map<string, string>()
  for (const kind of KIND_ORDER) {
    const dir = join(repoRoot, 'meta', KIND_DIR[kind])
    if (!existsSync(dir)) continue
    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.md'))
      .toSorted()
    for (const f of files) {
      const asset = parseMetaFile(readFileSync(join(dir, f), 'utf8'), f, kind)
      const key = `${asset.kind}:${asset.name}`
      const prior = seen.get(key)
      if (prior !== undefined) {
        throw new Error(`duplicate asset name '${asset.name}' in ${prior} and ${asset.metaPath}`)
      }
      seen.set(key, asset.metaPath)
      assets.push(asset)
    }
  }
  return assets
}
