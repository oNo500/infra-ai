#!/usr/bin/env tsx

import fs from 'fs-extra'
import path from 'path'
import { glob } from 'glob'
import matter from 'gray-matter'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

interface SyncConfig {
  skillsDir: string
  agentsDir: string
  outputDir: string
}

interface SkillMetadata {
  name: string
  title: string
  description: string
}

interface AgentMetadata {
  name: string
  title: string
  description: string
}

// 配置
const config: SyncConfig = {
  skillsDir: path.join(__dirname, '../../../skills'),
  agentsDir: path.join(__dirname, '../../../agents'),
  outputDir: path.join(__dirname, '../../docs/content/docs'),
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 开始同步文档...\n')

  try {
    // 1. 清理旧的生成文件
    await cleanGeneratedDocs()

    // 2. 同步 Skills
    await syncSkills()

    // 3. 同步 Agents
    await syncAgents()

    // 4. 生成索引页
    await generateIndexPages()

    console.log('\n✅ 文档同步完成！')
  } catch (error) {
    console.error('\n❌ 同步失败:', error)
    process.exit(1)
  }
}

/**
 * 清理生成的文档
 */
async function cleanGeneratedDocs() {
  const dirsToClean = [
    path.join(config.outputDir, 'skills'),
    path.join(config.outputDir, 'agents'),
  ]

  for (const dir of dirsToClean) {
    if (await fs.pathExists(dir)) {
      await fs.remove(dir)
      console.log(`🗑️  清理: ${path.relative(process.cwd(), dir)}`)
    }
  }
}

/**
 * 获取目录列表
 */
async function getDirectories(sourcePath: string): Promise<string[]> {
  if (!(await fs.pathExists(sourcePath))) {
    return []
  }

  const entries = await fs.readdir(sourcePath, { withFileTypes: true })
  return entries
    .filter((entry: fs.Dirent) => entry.isDirectory())
    .filter((entry: fs.Dirent) => !entry.name.startsWith('.'))
    .map((entry: fs.Dirent) => entry.name)
}

/**
 * 处理 Frontmatter 并替换不支持的语言
 */
function processFrontmatter(content: string, metadata: Record<string, any>): string {
  const { data, content: body } = matter(content)

  const enhanced = {
    ...data,
    ...metadata,
  }

  // 替换 svg 为 xml 以避免 Shiki 报错
  const processedBody = body.replace(/```svg/g, '```xml')

  return matter.stringify(processedBody, enhanced)
}

/**
 * 同步 Skills
 */
async function syncSkills() {
  console.log('\n📚 同步 Skills...')

  const skillDirs = await getDirectories(config.skillsDir)
  const skillsMetadata: SkillMetadata[] = []

  for (const skillName of skillDirs) {
    console.log(`  ├─ ${skillName}`)

    const skillSourceDir = path.join(config.skillsDir, skillName)
    const skillOutputDir = path.join(config.outputDir, 'skills', skillName)

    // 确保输出目录存在
    await fs.ensureDir(skillOutputDir)

    // 复制 SKILL.md → index.mdx
    const skillMdPath = path.join(skillSourceDir, 'SKILL.md')
    if (await fs.pathExists(skillMdPath)) {
      const content = await fs.readFile(skillMdPath, 'utf-8')
      const { data } = matter(content)

      const title = data.title || data.name || skillName
      
      // 保存 metadata 用于生成列表
      skillsMetadata.push({
        name: skillName,
        title: title,
        description: data.description || '',
      })

      // 确保 frontmatter 包含 title
      const processedContent = processFrontmatter(content, {
        title: title
      })

      // 写入 index.mdx
      const outputPath = path.join(skillOutputDir, 'index.mdx')
      await fs.writeFile(outputPath, processedContent, 'utf-8')
      console.log(`    ✓ index.mdx`)
    }

    // 复制 rules/*.md → rules/*.mdx
    const rulesDir = path.join(skillSourceDir, 'rules')
    if (await fs.pathExists(rulesDir)) {
      const ruleFiles = await glob('*.md', { cwd: rulesDir })

      if (ruleFiles.length > 0) {
        const rulesOutputDir = path.join(skillOutputDir, 'rules')
        await fs.ensureDir(rulesOutputDir)

        for (const ruleFile of ruleFiles) {
          const sourcePath = path.join(rulesDir, ruleFile)
          const targetPath = path.join(rulesOutputDir, ruleFile.replace('.md', '.mdx'))
          const ruleName = path.basename(ruleFile, '.md')

          const content = await fs.readFile(sourcePath, 'utf-8')
          const { data } = matter(content)
          
          // 确保规则文件也有 title
          const processedContent = processFrontmatter(content, {
            title: data.title || ruleName
          })
          
          await fs.writeFile(targetPath, processedContent, 'utf-8')
        }
        console.log(`    ✓ ${ruleFiles.length} rules`)
      }
    }
  }

  // 生成 skills/index.mdx
  await generateSkillsIndex(skillsMetadata)
}

/**
 * 同步 Agents
 */
async function syncAgents() {
  console.log('\n🤖 同步 Agents...')

  const agentDirs = await getDirectories(config.agentsDir)
  const agentsMetadata: AgentMetadata[] = []

  const agentsOutputDir = path.join(config.outputDir, 'agents')
  await fs.ensureDir(agentsOutputDir)

  for (const agentName of agentDirs) {
    console.log(`  ├─ ${agentName}`)

    const agentSourcePath = path.join(config.agentsDir, agentName, 'AGENTS.md')

    if (await fs.pathExists(agentSourcePath)) {
      const content = await fs.readFile(agentSourcePath, 'utf-8')
      const { data } = matter(content)

      const title = data.title || agentName

      // 保存 metadata 用于生成列表
      agentsMetadata.push({
        name: agentName,
        title: title,
        description: data.description || '',
      })

      // 确保 frontmatter 包含 title
      const processedContent = processFrontmatter(content, {
        title: title
      })

      // 写入 {agent-name}.mdx
      const outputPath = path.join(agentsOutputDir, `${agentName}.mdx`)
      await fs.writeFile(outputPath, processedContent, 'utf-8')
      console.log(`    ✓ ${agentName}.mdx`)
    }
  }

  // 生成 agents/index.mdx
  await generateAgentsIndex(agentsMetadata)
}

/**
 * 转义字符串以用于 JSX 属性
 */
function escapeString(str: string): string {
  return str.replace(/"/g, '&quot;')
}

/**
 * 生成 Skills 列表页
 */
async function generateSkillsIndex(skills: SkillMetadata[]) {
  const content = `---
title: Skills
description: 浏览所有可用的技能指南
---

# Skills

查看所有可用的性能优化和最佳实践技能指南。

<Cards>
${skills.map((skill) => `  <Card 
    title="${escapeString(skill.title)}" 
    href="/skills/${skill.name}" 
    description="${escapeString(skill.description)}"
  />`).join('\n')}
</Cards>
`

  const outputPath = path.join(config.outputDir, 'skills', 'index.mdx')
  await fs.writeFile(outputPath, content, 'utf-8')
  console.log(`  ✓ skills/index.mdx (${skills.length} skills)`)
}

/**
 * 生成 Agents 列表页
 */
async function generateAgentsIndex(agents: AgentMetadata[]) {
  const content = `---
title: Agents
description: 探索预配置的 AI 代理
---

# Agents

查看所有预配置的 AI 代理，每个代理包含合并后的完整规则集。

<Cards>
${agents.map((agent) => `  <Card 
    title="${escapeString(agent.title)}" 
    href="/agents/${agent.name}" 
    description="${escapeString(agent.description)}"
  />`).join('\n')}
</Cards>
`

  const outputPath = path.join(config.outputDir, 'agents', 'index.mdx')
  await fs.writeFile(outputPath, content, 'utf-8')
  console.log(`  ✓ agents/index.mdx (${agents.length} agents)`)
}

/**
 * 生成索引页（首页保持手动维护）
 */
async function generateIndexPages() {
  // 首页由用户手动维护，这里不生成
  console.log('\n📄 索引页生成完成')
}

// 运行主函数
main()
