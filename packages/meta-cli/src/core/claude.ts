import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import matter from 'gray-matter'
import { readTextIfExists, sha256 } from './io'
import type { MetaAsset } from './meta'
import { loadLock, saveLock } from './registry'
import { lockKey } from './status'

const BUILD_RULE: Record<MetaAsset['kind'], string> = {
  rule: 'meta/build/rule.md',
  skill: 'meta/build/skill.md',
  template: 'meta/build/template.md',
}

export function parseStreamJsonLine(line: string): { type: string; text: string | null } | null {
  const trimmed = line.trim()
  if (trimmed === '') return null
  let raw: unknown
  try {
    raw = JSON.parse(trimmed)
  } catch {
    return null
  }
  if (typeof raw !== 'object' || raw === null || typeof (raw as { type?: unknown }).type !== 'string') {
    return null
  }
  const event = raw as { type: string; message?: { content?: unknown }; result?: unknown }
  if (event.type === 'assistant' && Array.isArray(event.message?.content)) {
    const text = event.message.content
      .filter(
        (b): b is { type: string; text: string } =>
          typeof b === 'object' && b !== null && (b as { type?: unknown }).type === 'text',
      )
      .map((b) => b.text)
      .join('')
    return { type: 'assistant', text: text === '' ? null : text }
  }
  if (event.type === 'result') {
    return { type: 'result', text: typeof event.result === 'string' ? event.result : null }
  }
  return { type: event.type, text: null }
}

export function buildPromptFor(asset: MetaAsset): string {
  return [
    `构建 ${asset.metaPath}，遵循 ${BUILD_RULE[asset.kind]} 的构建规则。`,
    `产物写入 ${asset.artifactPath}。不要修改其他文件，不要提交。`,
  ].join('\n')
}

export function writebackPromptFor(asset: MetaAsset): string {
  return [
    `产物 ${asset.artifactPath} 相对上次构建被直接修改过。`,
    `对照元指令 ${asset.metaPath}，把产物中元指令未覆盖的有价值内容回写进元指令正文，`,
    `保持 frontmatter 不变。只修改 ${asset.metaPath}，不要改产物，不要提交。`,
  ].join('\n')
}

export function allowedToolsFor(asset: MetaAsset, mode: 'build' | 'writeback'): string {
  const writable =
    mode === 'writeback'
      ? asset.metaPath
      : asset.kind === 'skill'
        ? `${dirname(asset.artifactPath)}/**`
        : `${asset.artifactPath.split('/')[0]}/**`
  return `Read,Glob,Grep,Write(${writable}),Edit(${writable})`
}

export interface RunResult {
  code: number
  timedOut: boolean
  stderr: string
}

export function runClaude(opts: {
  repoRoot: string
  prompt: string
  allowedTools: string
  timeoutMs?: number
  onText?: (t: string) => void
}): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = spawn(
      'claude',
      [
        '-p',
        opts.prompt,
        '--output-format',
        'stream-json',
        '--verbose',
        '--allowedTools',
        opts.allowedTools,
      ],
      { cwd: opts.repoRoot, stdio: ['ignore', 'pipe', 'pipe'] },
    )
    let stderr = ''
    let buffer = ''
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, opts.timeoutMs ?? 300_000)

    child.stdout.on('data', (d: Buffer) => {
      buffer += d.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const event = parseStreamJsonLine(line)
        if (event?.text) opts.onText?.(event.text)
      }
    })
    child.stderr.on('data', (d: Buffer) => {
      stderr += d.toString()
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (buffer !== '') {
        const event = parseStreamJsonLine(buffer)
        if (event?.text) opts.onText?.(event.text)
      }
      resolve({ code: code ?? -1, timedOut, stderr })
    })
    child.on('error', (err) => {
      clearTimeout(timer)
      resolve({ code: -1, timedOut, stderr: String(err) })
    })
  })
}

export function verifyBuild(repoRoot: string, asset: MetaAsset): string | null {
  const content = readTextIfExists(join(repoRoot, asset.artifactPath))
  if (content === null) return `artifact missing: ${asset.artifactPath}`
  if (content.trim() === '') return `artifact empty: ${asset.artifactPath}`
  if (asset.kind === 'skill') {
    try {
      const { data } = matter(content)
      if (data.name !== asset.name) {
        return `SKILL.md frontmatter name '${String(data.name)}' != '${asset.name}'`
      }
    } catch (e) {
      return `SKILL.md frontmatter unparseable: ${String(e)}`
    }
  }
  return null
}

export function recordBuild(repoRoot: string, asset: MetaAsset, builtAt: string): void {
  const metaContent = readTextIfExists(join(repoRoot, asset.metaPath)) ?? ''
  const artifactContent = readTextIfExists(join(repoRoot, asset.artifactPath)) ?? ''
  const lock = loadLock(repoRoot)
  saveLock(repoRoot, {
    ...lock,
    [lockKey(asset)]: {
      metaHash: sha256(metaContent),
      artifactHash: sha256(artifactContent),
      builtAt,
    },
  })
}
