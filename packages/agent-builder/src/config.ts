/**
 * Agent configurations
 */

import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import type { AgentConfig } from './types.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

export const AGENTS_DIR = join(__dirname, '../../..', 'agents')

export const agents: Record<string, AgentConfig> = {
  'nextjs-architecture': {
    name: 'nextjs-architecture',
    title: 'Next.js Architecture',
    abstract:
      'Next.js 15 + React 19 项目架构指南，基于 Bulletproof React 模式。包含架构核心、项目标准、开发规范三个类别的规则。',
    version: '1.0.0',
    organization: 'xiu',
    sectionMap: {
      arch: 1,
      std: 2,
      dev: 3,
    },
  },
}
