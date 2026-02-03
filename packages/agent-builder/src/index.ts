#!/usr/bin/env node
/**
 * Agent Builder - 将规则文件编译为 AGENTS.md
 */

import { readdir, readFile, writeFile } from 'fs/promises'
import { join, basename } from 'path'
import matter from 'gray-matter'
import type { Rule, Section, ImpactLevel } from './types.js'
import { agentNames, AGENTS_DIR, SKILLS_DIR } from './config.js'
import { loadMetadata, extractCodeExamples, displayHelp } from './utils.js'
import { generateMarkdown } from './markdown.js'

/** 解析命令行参数 */
const args = process.argv.slice(2)
const buildAll = args.includes('--all')
const showHelp = args.includes('--help') || args.includes('-h')
const agentName = args.find((a) => !a.startsWith('-'))



/** 解析单个规则文件 */
async function parseRule(
  filePath: string,
  sectionMap: Map<string, number>
): Promise<{ section: number; rule: Rule }> {
  const filename = basename(filePath)
  const fileContent = await readFile(filePath, 'utf-8')

  // 解析 frontmatter
  const { data: frontmatter, content: body } = matter(fileContent)

  // 提取标题
  const titleMatch = body.match(/^##\s+(.+)$/m)
  const title = frontmatter.title || titleMatch?.[1] || 'Untitled'

  // 提取影响级别
  const impactMatch = body.match(/\*\*Impact:\s*(\w+(?:-\w+)?)/i)
  const impact = (frontmatter.impact || impactMatch?.[1] || 'MEDIUM').toUpperCase() as ImpactLevel

  // 提取内容（标题之后）
  const titleIndex = body.search(/^##\s+.+$/m)
  const afterTitle = titleIndex >= 0 ? body.slice(titleIndex).replace(/^##.+\n+/, '') : body

  // 提取说明和代码示例
  const { explanation, examples } = extractCodeExamples(afterTitle)

  // 从文件名确定章节（匹配最长前缀）
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

  return { section, rule: { id: '', title, impact, explanation, examples } }
}



/** 构建单个 agent */
async function buildAgent(agentName: string) {
  console.log(`\nBuilding ${agentName}...`)

  // 加载元数据
  const metadata = await loadMetadata(agentName)

  // 读取规则文件
  const rulesDir = join(SKILLS_DIR, agentName, 'rules')
  const files = (await readdir(rulesDir))
    .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
    .sort()

  // 创建章节映射
  const sectionMap = new Map<string, number>()
  metadata.sections.forEach((s, i) => sectionMap.set(s.id, i + 1))

  // 并行解析所有规则文件
  const ruleData = await Promise.allSettled(
    files.map((file) => parseRule(join(rulesDir, file), sectionMap))
  )

  // 收集成功解析的规则
  const parsedRules = ruleData
    .filter((r): r is PromiseFulfilledResult<{ section: number; rule: Rule }> => r.status === 'fulfilled')
    .map((r) => r.value)

  // 按章节分组
  const sectionsMap = new Map<number, Section>()
  for (const { section, rule } of parsedRules) {
    if (!sectionsMap.has(section)) {
      sectionsMap.set(section, { number: section, title: '', impact: 'MEDIUM', rules: [] })
    }
    sectionsMap.get(section)!.rules.push(rule)
  }

  // 排序并分配 ID
  sectionsMap.forEach((s) => {
    s.rules.sort((a, b) => a.title.localeCompare(b.title, 'en-US'))
    s.rules.forEach((r, i) => (r.id = `${s.number}.${i + 1}`))
  })

  // 合并元数据
  const sections = Array.from(sectionsMap.values())
    .sort((a, b) => a.number - b.number)
    .map((s) => {
      const meta = metadata.sections.find((_, i) => i + 1 === s.number)
      return { ...s, title: meta?.title || s.title, impact: meta?.impact || s.impact, description: meta?.description }
    })

  // 生成并写入文件
  const markdown = generateMarkdown(sections, metadata)
  const outputPath = join(AGENTS_DIR, agentName, 'AGENTS.md')
  await writeFile(outputPath, markdown, 'utf-8')

  console.log(`  -> ${outputPath}`)
  console.log(`  ${sections.length} sections, ${parsedRules.length} rules`)
}



/** 主函数 */
async function main() {
  console.log('Agent Builder\n')

  // 显示帮助
  if (showHelp) {
    displayHelp(agentNames)
    return
  }

  // 构建所有 agents
  if (buildAll) {
    for (const name of agentNames) await buildAgent(name)
    console.log('\nDone!')
    return
  }

  // 构建指定 agent
  if (agentName) {
    if (!agentNames.includes(agentName)) {
      console.error(`❌ 错误: 未知的 agent "${agentName}"\n`)
      displayHelp(agentNames)
      process.exit(1)
    }
    await buildAgent(agentName)
    console.log('\nDone!')
    return
  }

  // 没有参数，显示帮助
  console.error('❌ 错误: 缺少参数\n')
  displayHelp(agentNames)
  process.exit(1)
}

main().catch((e) => {
  console.error('Build failed:', e)
  process.exit(1)
})
