import { join } from 'node:path'
import matter from 'gray-matter'
import { readTextIfExists } from './io'

export type AssetKind = 'rule' | 'skill' | 'template'

export type FetchJson = (url: string) => Promise<unknown>

const UNGH_OFFICIAL_FILES =
  'https://ungh.cc/repos/anthropics/claude-plugins-official/files/main'

export interface KindDef {
  metaDir: string
  artifactPath: (name: string, scope: string | null) => string
  buildPrompt: string
  writebackPrompt: string
  writableGlob: (name: string) => string
  extraAllowedTools: readonly string[]
  verifyArtifact: (repoRoot: string, asset: { name: string; artifactPath: string; scope: string | null }) => string | null
  preBuildCheck?: (fetchJson: FetchJson, asset: { name: string }) => Promise<string | null>
}

export const KIND_ORDER: readonly AssetKind[] = ['rule', 'skill', 'template']

export const KINDS: Record<AssetKind, KindDef> = {
  rule: {
    metaDir: 'meta/rules',
    artifactPath: (name, scope) => {
      const sub = scope !== null && scope !== 'global' ? 'scoped' : 'global'
      return `rules/${sub}/${name}.md`
    },
    buildPrompt: 'meta/prompts/rule-build.md',
    writebackPrompt: 'meta/prompts/rule-writeback.md',
    writableGlob: () => 'rules/**',
    extraAllowedTools: [],
    verifyArtifact: (repoRoot, asset) => {
      const content = readTextIfExists(join(repoRoot, asset.artifactPath))
      if (content === null) return null // 存在性由通用校验负责
      let data: Record<string, unknown>
      try {
        data = matter(content).data as Record<string, unknown>
      } catch (error) {
        return `rule frontmatter unparseable: ${String(error)}`
      }
      const scoped = asset.scope !== null && asset.scope !== 'global'
      const paths = data.paths
      if (scoped) {
        if (!Array.isArray(paths) || !paths.includes(asset.scope)) {
          return `scoped rule must carry paths frontmatter matching scope '${asset.scope}'`
        }
        return null
      }
      if (paths !== undefined) return 'global rule must not carry paths frontmatter'
      return null
    },
  },
  skill: {
    metaDir: 'meta/skills',
    artifactPath: (name) => `skills/${name}/SKILL.md`,
    buildPrompt: 'meta/prompts/skill-build.md',
    writebackPrompt: 'meta/prompts/skill-writeback.md',
    writableGlob: (name) => `skills/${name}/**`,
    extraAllowedTools: [],
    verifyArtifact: (repoRoot, asset) => {
      const content = readTextIfExists(join(repoRoot, asset.artifactPath))
      if (content === null) return null // 存在性由通用校验负责
      try {
        const { data } = matter(content)
        if (data.name !== asset.name) {
          return `SKILL.md frontmatter name '${String(data.name)}' != '${asset.name}'`
        }
      } catch (error) {
        return `SKILL.md frontmatter unparseable: ${String(error)}`
      }
      return null
    },
    preBuildCheck: async (fetchJson, asset) => {
      const tree = (await fetchJson(UNGH_OFFICIAL_FILES)) as { files?: { path?: unknown }[] }
      const files = Array.isArray(tree.files) ? tree.files : []
      const hit = files.find((f) => {
        const parts = (typeof f.path === 'string' ? f.path : '').split('/')
        return (
          (parts[0] === 'plugins' && parts[2] === 'skills' && parts[3] === asset.name) ||
          (parts[0] === 'external_plugins' && parts[1] === asset.name)
        )
      })
      return hit
        ? `official catalog already has '${asset.name}': record it as official in skills.json instead of building`
        : null
    },
  },
  template: {
    metaDir: 'meta/templates',
    artifactPath: (name) => `templates/${name}.md`,
    buildPrompt: 'meta/prompts/template-build.md',
    writebackPrompt: 'meta/prompts/template-writeback.md',
    writableGlob: () => 'templates/**',
    extraAllowedTools: [],
    verifyArtifact: (repoRoot, asset) => {
      const content = readTextIfExists(join(repoRoot, asset.artifactPath))
      if (content === null) return null
      if (!/\[[A-Z][A-Z0-9_]*\]/u.test(content)) {
        return 'template must keep at least one [ALL_CAPS] placeholder'
      }
      return null
    },
  },
}
