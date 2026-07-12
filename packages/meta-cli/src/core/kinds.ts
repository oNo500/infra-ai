import { join } from 'node:path'
import matter from 'gray-matter'
import { readTextIfExists } from './io'

export type AssetKind = 'rule' | 'skill' | 'template'

export interface KindDef {
  metaDir: string
  artifactPath: (name: string, scope: string | null) => string
  buildPrompt: string
  writebackPrompt: string
  writableGlob: (name: string) => string
  extraAllowedTools: readonly string[]
  verifyArtifact: (repoRoot: string, asset: { name: string; artifactPath: string }) => string | null
}

export const KIND_ORDER: readonly AssetKind[] = ['rule', 'skill', 'template']

const noExtraVerify = () => null

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
    verifyArtifact: noExtraVerify,
  },
  skill: {
    metaDir: 'meta/skills',
    artifactPath: (name) => `skills/${name}/SKILL.md`,
    buildPrompt: 'meta/prompts/skill-build.md',
    writebackPrompt: 'meta/prompts/skill-writeback.md',
    writableGlob: (name) => `skills/${name}/**`,
    extraAllowedTools: ['WebFetch(domain:ungh.cc)'],
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
  },
  template: {
    metaDir: 'meta/templates',
    artifactPath: (name) => `templates/${name}.md`,
    buildPrompt: 'meta/prompts/template-build.md',
    writebackPrompt: 'meta/prompts/template-writeback.md',
    writableGlob: () => 'templates/**',
    extraAllowedTools: [],
    verifyArtifact: noExtraVerify,
  },
}
