import { describe, expect, test } from 'bun:test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const REPO_ROOT = join(import.meta.dir, '..', '..', '..')
const PROMPTS_DIR = join(REPO_ROOT, 'meta', 'prompts')

// 只用精确短语：宽泛词（如「触发」）会命中领域词造成误报
const PROCESS_PHRASES = ['上账', 'imeta ', 'TUI', 'make ', '对 Claude 说']

describe('prompt documents', () => {
  test('stay free of process phrases (AI-only content red line)', () => {
    const files = readdirSync(PROMPTS_DIR).filter((f) => f.endsWith('.md'))
    expect(files.length).toBeGreaterThanOrEqual(6)
    for (const file of files) {
      const content = readFileSync(join(PROMPTS_DIR, file), 'utf8')
      for (const phrase of PROCESS_PHRASES) {
        expect(content.includes(phrase), `${file} contains process phrase '${phrase}'`).toBe(false)
      }
    }
  })
})
