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

export function parseMetaFile(content: string, filename: string, kind: AssetKind): MetaAsset {
  const { data } = matter(content)
  const name = typeof data.name === 'string' ? data.name : filename.replace(/\.md$/, '')
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
  for (const kind of KIND_ORDER) {
    const dir = join(repoRoot, 'meta', KIND_DIR[kind])
    if (!existsSync(dir)) continue
    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.md'))
      .sort()
    for (const f of files) {
      assets.push(parseMetaFile(readFileSync(join(dir, f), 'utf8'), f, kind))
    }
  }
  return assets
}
