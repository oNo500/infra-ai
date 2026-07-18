import { homedir } from 'node:os'
import { join } from 'node:path'
import { defineCommand, runMain } from 'citty'
import { downloadTemplate } from 'giget'
import { runClaude, runCommand } from '@infra-ai/meta-cli/core'
import type { IuseContext } from '../core/init'
import { runInit } from '../core/init'
import { profilesReport } from '../core/profiles-report'
import { statusReport } from '../core/report'
import { runUpdate } from '../core/update'

export function defaultContext(): IuseContext {
  return {
    download: downloadTemplate,
    run: runCommand,
    claude: runClaude,
    now: () => new Date().toISOString(),
    env: process.env,
    home: homedir(),
    cacheDir: join(homedir(), '.cache/iuse'),
  }
}

/**
 * Serializes a JSON result payload to a single line, for stdout in --json mode.
 * Extracted as a pure function so shape can be asserted without spawning the CLI.
 */
export function renderJson(result: unknown): string {
  return JSON.stringify(result)
}

const initCommand = defineCommand({
  meta: {
    name: 'init',
    description:
      '按 profile 向目标项目拼装配置（rules + settings + AI 实例化 CLAUDE.md/architecture）。--dry-run 预演。成功退 0。',
  },
  args: {
    profile: { type: 'string', required: true, description: '要拼装的 profile 名（见 iuse profiles）' },
    source: { type: 'string', description: '中心源（本地路径或 gh: 定位符；缺省 INFRA_AI_ROOT 或 ~/code/infra-ai）' },
    force: { type: 'boolean', description: '重新初始化：覆盖已有内容并重新实例化模板' },
    'dry-run': { type: 'boolean', description: '只打印计划步骤，不写任何文件' },
    json: { type: 'boolean', description: '以单行 JSON 输出到 stdout（机器可读）' },
    target: { type: 'positional', required: false, description: '目标项目目录（缺省当前目录）' },
  },
  async run({ args }) {
    const result = await runInit(defaultContext(), {
      profile: args.profile,
      source: args.source,
      force: args.force ?? false,
      dryRun: args['dry-run'] ?? false,
      target: args.target ?? process.cwd(),
    })
    if (args.json === true) {
      const payload = result.steps === undefined
        ? { ok: result.ok, message: result.message }
        : { ok: result.ok, message: result.message, steps: result.steps }
      console.log(renderJson(payload))
    } else {
      console.log(result.message)
    }
    if (!result.ok) process.exitCode = 1
  },
})

const profilesCommand = defineCommand({
  meta: {
    name: 'profiles',
    description: '列出中心源可用的 profile 及各自的 rules。恒退 0。',
  },
  args: {
    source: { type: 'string', description: '中心源（本地路径或 gh: 定位符；缺省 INFRA_AI_ROOT 或 ~/code/infra-ai）' },
    json: { type: 'boolean', description: '以单行 JSON 输出到 stdout（机器可读）' },
  },
  async run({ args }) {
    const result = await profilesReport(defaultContext(), {
      source: args.source,
    })
    if (args.json === true) {
      const payload = result.ok
        ? { ok: true, profiles: result.profiles ?? [] }
        : { ok: false, message: result.message }
      console.log(renderJson(payload))
    } else {
      if (result.message !== undefined) console.log(result.message)
      if (result.profilesText !== undefined) console.log(result.profilesText)
    }
    process.exitCode = result.exitCode
  },
})

const statusCommand = defineCommand({
  meta: {
    name: 'status',
    description:
      '逐 rule 对账下游副本与中心源的漂移（synced/modified/outdated/missing）。有待处理项退 1，干净退 0。',
  },
  args: {
    source: { type: 'string', description: '中心源（本地路径或 gh: 定位符；缺省 INFRA_AI_ROOT 或 ~/code/infra-ai）' },
    json: { type: 'boolean', description: '以单行 JSON 输出到 stdout（机器可读）' },
    target: { type: 'positional', required: false, description: '目标项目目录（缺省当前目录）' },
  },
  async run({ args }) {
    const result = await statusReport(defaultContext(), {
      source: args.source,
      target: args.target ?? process.cwd(),
    })
    if (args.json === true) {
      const payload = result.ok
        ? { ok: true, rows: result.rows, exitCode: result.exitCode }
        : { ok: false, message: result.message, exitCode: result.exitCode }
      console.log(renderJson(payload))
    } else {
      if (result.message !== undefined) console.log(result.message)
      for (const row of result.rows) console.log(`${row.rule} ${row.state}`)
    }
    process.exitCode = result.exitCode
  },
})

const updateCommand = defineCommand({
  meta: {
    name: 'update',
    description:
      '应用中心源变更到已初始化目标；本地改过的副本默认跳过，--force 才覆盖。--dry-run 预演。成功退 0。',
  },
  args: {
    source: { type: 'string', description: '中心源（本地路径或 gh: 定位符；缺省 INFRA_AI_ROOT 或 ~/code/infra-ai）' },
    force: { type: 'boolean', description: '覆盖本地已修改或缺失的 rule 副本' },
    'dry-run': { type: 'boolean', description: '只打印计划步骤，不应用任何变更' },
    json: { type: 'boolean', description: '以单行 JSON 输出到 stdout（机器可读）' },
    target: { type: 'positional', required: false, description: '目标项目目录（缺省当前目录）' },
  },
  async run({ args }) {
    const result = await runUpdate(defaultContext(), {
      source: args.source,
      force: args.force ?? false,
      dryRun: args['dry-run'] ?? false,
      target: args.target ?? process.cwd(),
    })
    if (args.json === true) {
      const payload = result.steps === undefined
        ? { ok: result.ok, message: result.message }
        : { ok: result.ok, message: result.message, steps: result.steps }
      console.log(renderJson(payload))
    } else {
      console.log(result.message)
    }
    if (!result.ok) process.exitCode = 1
  },
})

export function buildMainCommand() {
  return defineCommand({
    meta: {
      name: 'iuse',
      description:
        '从 infra-ai 中心源按 profile 拼装 Claude Code 配置。典型流程：profiles -> init --dry-run -> init -> status/update。',
    },
    subCommands: { init: initCommand, profiles: profilesCommand, status: statusCommand, update: updateCommand },
  })
}

export async function runCli(): Promise<void> {
  await runMain(buildMainCommand())
}
