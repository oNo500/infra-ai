/**
 * 工具函数
 */

import { readFile } from 'fs/promises'
import { join } from 'path'
import type { CodeExample, MetadataConfig } from './types.js'
import { AGENTS_DIR } from './config.js'

/** 生成 markdown 锚点 */
export const toAnchor = (text: string) => text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')

/** 提取代码示例和说明文本 */
export function extractCodeExamples(text: string): { explanation: string; examples: CodeExample[] } {
  const parts = text.split(/(```[\s\S]*?```)/g)
  let explanation = ''
  const examples: CodeExample[] = []

  for (const part of parts) {
    if (part.startsWith('```')) {
      const match = part.match(/```(\w+)?\n([\s\S]*?)```/)
      if (match) {
        examples.push({
          label: 'Example',
          code: match[2].trim(),
          language: match[1] || 'typescript',
        })
      }
    } else {
      const labeledMatch = part.match(/\*\*([^:]+):\*\*\s*$/m)
      if (labeledMatch && examples.length > 0) {
        examples[examples.length - 1].label = labeledMatch[1].trim()
      } else {
        const text = part.replace(/\*\*Impact:.*\*\*\n*/gi, '').trim()
        if (text && !explanation) explanation = text
      }
    }
  }

  return { explanation, examples }
}

/** 加载 agent 的 metadata.json */
export async function loadMetadata(agentName: string): Promise<MetadataConfig> {
  const metadataPath = join(AGENTS_DIR, agentName, 'metadata.json')
  const content = await readFile(metadataPath, 'utf-8')
  return JSON.parse(content) as MetadataConfig
}

/** 显示帮助信息 */
export function displayHelp(agentNames: string[]) {
  console.log(`
使用方法:
  pnpm build <agent-name>    构建指定的 agent
  pnpm build --all           构建所有 agents
  pnpm build --help          显示此帮助信息

可用的 agents:
${agentNames.map((name) => `  - ${name}`).join('\n')}

示例:
  pnpm build nextjs-architecture
  pnpm build:all
`)
}

