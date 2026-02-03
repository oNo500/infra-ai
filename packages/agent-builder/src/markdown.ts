/**
 * Markdown 文档生成
 */

import type { Section, MetadataConfig } from './types.js'
import { toAnchor } from './utils.js'

/** 生成 AGENTS.md 内容 */
export function generateMarkdown(sections: Section[], metadata: MetadataConfig): string {
  const { title, abstract, version = '1.0.0', organization = 'Engineering' } = metadata
  let md = `# ${title}\n\n`
  md += `> Version ${version} | ${organization}\n\n`
  md += `## Abstract\n\n${abstract}\n\n---\n\n`
  md += `## Table of Contents\n\n`

  // 生成目录
  for (const s of sections) {
    md += `${s.number}. [${s.title}](#${s.number}-${toAnchor(s.title)}) — **${s.impact}**\n`
    for (const r of s.rules) {
      md += `   - ${r.id} [${r.title}](#${toAnchor(`${r.id}-${r.title}`)})\n`
    }
  }
  md += `\n---\n\n`

  // 生成章节内容
  for (const s of sections) {
    md += `## ${s.number}. ${s.title}\n\n**Impact: ${s.impact}**\n\n`
    if (s.description) md += `${s.description}\n\n`

    for (const r of s.rules) {
      md += `### ${r.id} ${r.title}\n\n**Impact: ${r.impact}**\n\n`
      if (r.explanation) md += `${r.explanation}\n\n`

      for (const ex of r.examples) {
        md += `**${ex.label}${ex.description ? ` (${ex.description})` : ''}:**\n\n`
        md += `\`\`\`${ex.language}\n${ex.code}\n\`\`\`\n\n`
      }
    }
    md += `---\n\n`
  }

  return md
}
