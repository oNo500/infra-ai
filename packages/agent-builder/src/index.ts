#!/usr/bin/env node
/**
 * Agent Builder - Compile rule files into AGENTS.md
 */

import { readdir, readFile, writeFile } from 'fs/promises'
import { join, basename } from 'path'
import type { Rule, Section, CodeExample, ImpactLevel, AgentConfig, MetadataConfig, SectionConfig } from './types.js'
import { agentNames, AGENTS_DIR, SKILLS_DIR } from './config.js'

// Parse CLI arguments
const args = process.argv.slice(2)
const buildAll = args.includes('--all')
const agentName = args.find((a) => !a.startsWith('-'))

/**
 * Load metadata.json for an agent
 */
async function loadMetadata(agentName: string): Promise<MetadataConfig> {
  const metadataPath = join(AGENTS_DIR, agentName, 'metadata.json')
  const content = await readFile(metadataPath, 'utf-8')
  return JSON.parse(content) as MetadataConfig
}

/**
 * Parse a rule markdown file
 */
async function parseRule(
  filePath: string,
  sectionMap: Map<string, number>
): Promise<{ section: number; rule: Rule }> {
  const content = (await readFile(filePath, 'utf-8')).replace(/\r\n/g, '\n')
  const filename = basename(filePath)

  // Extract frontmatter
  let frontmatter: Record<string, string> = {}
  let body = content
  if (content.startsWith('---')) {
    const end = content.indexOf('---', 3)
    if (end !== -1) {
      content
        .slice(3, end)
        .trim()
        .split('\n')
        .forEach((line) => {
          const [key, ...vals] = line.split(':')
          if (key && vals.length) {
            frontmatter[key.trim()] = vals.join(':').trim().replace(/^["']|["']$/g, '')
          }
        })
      body = content.slice(end + 3).trim()
    }
  }

  // Extract title from first ## heading
  const titleMatch = body.match(/^##\s+(.+)$/m)
  const title = frontmatter.title || titleMatch?.[1] || 'Untitled'

  // Extract impact
  const impactMatch = body.match(/\*\*Impact:\s*(\w+(?:-\w+)?)/i)
  const impact = (frontmatter.impact || impactMatch?.[1] || 'MEDIUM').toUpperCase() as ImpactLevel

  // Extract content after title heading
  const titleIndex = body.search(/^##\s+.+$/m)
  const afterTitle = titleIndex >= 0 ? body.slice(titleIndex).replace(/^##.+\n+/, '') : body

  // Split into text and code blocks
  const parts = afterTitle.split(/(```[\s\S]*?```)/g)
  let explanation = ''
  const examples: CodeExample[] = []

  for (const part of parts) {
    if (part.startsWith('```')) {
      // Code block
      const match = part.match(/```(\w+)?\n([\s\S]*?)```/)
      if (match) {
        examples.push({
          label: 'Example',
          code: match[2].trim(),
          language: match[1] || 'typescript',
        })
      }
    } else {
      // Text - check for labeled examples like **Incorrect:** or add to explanation
      const labeledMatch = part.match(/\*\*([^:]+):\*\*\s*$/m)
      if (labeledMatch && examples.length > 0) {
        // This is a label for the next code block
        examples[examples.length - 1].label = labeledMatch[1].trim()
      } else {
        // Regular explanation text
        const text = part.replace(/\*\*Impact:.*\*\*\n*/gi, '').trim()
        if (text && !explanation) {
          explanation = text
        }
      }
    }
  }

  // Determine section from filename prefix
  const filenameParts = filename.replace('.md', '').split('-')
  let section = 0
  for (let len = filenameParts.length; len > 0; len--) {
    const prefix = filenameParts.slice(0, len).join('-')
    const sectionNum = sectionMap.get(prefix)
    if (sectionNum !== undefined) {
      section = sectionNum
      break
    }
  }

  return {
    section,
    rule: { id: '', title, impact, explanation, examples },
  }
}



/**
 * Generate AGENTS.md content
 */
function generateMarkdown(sections: Section[], metadata: MetadataConfig): string {
  const { title, abstract, version = '1.0.0', organization = 'Engineering' } = metadata
  let md = `# ${title}\n\n`
  md += `> Version ${version} | ${organization}\n\n`
  md += `## Abstract\n\n${abstract}\n\n`
  md += `---\n\n`
  md += `## Table of Contents\n\n`

  // TOC
  for (const s of sections) {
    const anchor = `${s.number}-${s.title.toLowerCase().replace(/\s+/g, '-')}`
    md += `${s.number}. [${s.title}](#${anchor}) — **${s.impact}**\n`
    for (const r of s.rules) {
      const rAnchor = `${r.id}-${r.title}`.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')
      md += `   - ${r.id} [${r.title}](#${rAnchor})\n`
    }
  }
  md += `\n---\n\n`

  // Sections
  for (const s of sections) {
    md += `## ${s.number}. ${s.title}\n\n`
    md += `**Impact: ${s.impact}**\n\n`
    if (s.description) md += `${s.description}\n\n`

    for (const r of s.rules) {
      md += `### ${r.id} ${r.title}\n\n`
      md += `**Impact: ${r.impact}**\n\n`
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

/**
 * Build a single agent
 */
async function buildAgent(agentName: string) {
  console.log(`\nBuilding ${agentName}...`)
  
  // Load metadata
  const metadata = await loadMetadata(agentName)
  
  // Read rules from skills directory
  const rulesDir = join(SKILLS_DIR, agentName, 'rules')

  // Read rule files
  const files = (await readdir(rulesDir))
    .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
    .sort()

  // Create section map from metadata
  const sectionMap = new Map<string, number>()
  metadata.sections.forEach((s, i) => {
    sectionMap.set(s.id, i + 1)
  })
  
  // Parse rules
  const ruleData: { section: number; rule: Rule }[] = []
  for (const file of files) {
    try {
      const parsed = await parseRule(join(rulesDir, file), sectionMap)
      ruleData.push(parsed)
    } catch (e) {
      console.error(`  Error parsing ${file}:`, e)
    }
  }

  // Group by section
  const sectionsMap = new Map<number, Section>()
  for (const { section, rule } of ruleData) {
    if (!sectionsMap.has(section)) {
      sectionsMap.set(section, {
        number: section,
        title: `Section ${section}`,
        impact: 'MEDIUM',
        rules: [],
      })
    }
    sectionsMap.get(section)!.rules.push(rule)
  }

  // Sort and assign IDs
  sectionsMap.forEach((s) => {
    s.rules.sort((a, b) => a.title.localeCompare(b.title, 'en-US'))
    s.rules.forEach((r, i) => (r.id = `${s.number}.${i + 1}`))
  })

  // Merge section metadata from metadata.json
  const sections = Array.from(sectionsMap.values())
    .sort((a, b) => a.number - b.number)
    .map((s) => {
      const metaSection = metadata.sections.find((_, i) => i + 1 === s.number)
      return {
        ...s,
        title: metaSection?.title || s.title,
        impact: metaSection?.impact || s.impact,
        description: metaSection?.description,
      }
    })

  // Generate and write to agents directory
  const markdown = generateMarkdown(sections, metadata)
  const agentDir = join(AGENTS_DIR, agentName)
  const outputPath = join(agentDir, 'AGENTS.md')
  await writeFile(outputPath, markdown, 'utf-8')

  console.log(`  -> ${outputPath}`)
  console.log(`  ${sections.length} sections, ${ruleData.length} rules`)
}

/**
 * Main
 */
async function main() {
  console.log('Agent Builder')

  if (buildAll) {
    for (const name of agentNames) {
      await buildAgent(name)
    }
  } else if (agentName) {
    if (!agentNames.includes(agentName)) {
      console.error(`Unknown agent: ${agentName}`)
      console.error(`Available: ${agentNames.join(', ')}`)
      process.exit(1)
    }
    await buildAgent(agentName)
  } else {
    console.error('Usage: pnpm build <agent-name> | pnpm build --all')
    console.error(`Available agents: ${agentNames.join(', ')}`)
    process.exit(1)
  }

  console.log('\nDone!')
}

main().catch((e) => {
  console.error('Build failed:', e)
  process.exit(1)
})
