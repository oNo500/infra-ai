import { homedir } from 'node:os'
import { join } from 'node:path'
import { defineCommand, runMain } from 'citty'
import { downloadTemplate } from 'giget'
import { runClaude, runCommand } from '@infra-ai/meta-cli/core'
import { diffReport } from '../core/diff'
import { globalStatusReport } from '../core/global'
import type { IuseContext } from '../core/init'
import { runInit } from '../core/init'
import { listReport } from '../core/list'
import { profilesReport } from '../core/profiles-report'
import { statusReport } from '../core/report'
import { showReport } from '../core/show'
import { runUpdate } from '../core/update'

/**
 * Normalize and split a comma-separated string or array into trimmed strings.
 * Handles both single string and repeated flag inputs (citty passes string | string[]).
 * Returns undefined if input is undefined.
 */
export function splitNames(value: string | string[] | undefined): string[] | undefined {
  if (value === undefined) return undefined
  const raw = Array.isArray(value) ? value.join(',') : value
  return raw.split(',').map((s) => s.trim()).filter((s) => s.length > 0)
}

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

/**
 * --global and a positional target are mutually exclusive: --global always
 * operates on the fixed global root ($HOME), so a target positional would be
 * ambiguous. Shared by status/diff/list, which each accept both flags.
 * Returns an error message when both are set, otherwise null.
 */
export function validateGlobalArgs(args: { global?: boolean; target?: string }): string | null {
  if (args.global === true && args.target !== undefined) {
    return '--global 与 target 互斥（--global 固定对账 $HOME，不接受目标路径）'
  }
  return null
}

const initCommand = defineCommand({
  meta: {
    name: 'init',
    description:
      '按 profile 或显式 --rules 向目标项目拼装配置（rules + settings + AI 实例化 CLAUDE.md/architecture）。--profile 与 --rules 二选一。--dry-run 预演。成功退 0。',
  },
  args: {
    profile: { type: 'string', required: false, description: '要拼装的 profile 名（见 iuse profiles）；与 --rules 二选一' },
    rules: { type: 'string', description: '显式安装的 rule 名（逗号分隔）；与 --profile 二选一' },
    source: { type: 'string', description: '中心源（本地路径或 gh: 定位符；缺省 INFRA_AI_ROOT 或 ~/code/infra-ai）' },
    force: { type: 'boolean', description: '重新初始化：覆盖已有内容并重新实例化模板' },
    'dry-run': { type: 'boolean', description: '只打印计划步骤，不写任何文件' },
    exclude: { type: 'string', description: '排除的 rule 名（逗号分隔；记入下游账，之后 update --add 可补回）' },
    json: { type: 'boolean', description: '以单行 JSON 输出到 stdout（机器可读）' },
    target: { type: 'positional', required: false, description: '目标项目目录（缺省当前目录）' },
  },
  async run({ args }) {
    const exclude = splitNames(args.exclude)
    const rules = splitNames(args.rules)

    // 子命令面必须 100% 命令式：同一条命令在 pipe 与 PTY 下行为一致，
    // AI/脚本才有稳定契约。交互式的唯一入口是裸 iuse，这里只报错并指路。
    if ((args.profile === undefined) === (rules === undefined)) {
      console.error(
        [
          'exactly one of --profile / --rules is required',
          '',
          '选装内容二选一：',
          '  iuse init --profile <名>       用预设组合（iuse profiles 列出可选）',
          '  iuse init --rules a,b,c        直选 rule（iuse list 浏览全部）',
          '也可裸跑 iuse 进入交互式 TUI 边看边选。',
        ].join('\n'),
      )
      process.exitCode = 2
      return
    }

    const result = await runInit(defaultContext(), {
      profile: args.profile ?? '-',
      rules,
      source: args.source,
      force: args.force ?? false,
      dryRun: args['dry-run'] ?? false,
      target: args.target ?? process.cwd(),
      exclude,
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
      '逐 rule 对账下游副本与中心源的漂移（synced/modified/outdated/missing/excluded/available）。有待处理项退 1，干净退 0。',
  },
  args: {
    source: { type: 'string', description: '中心源（本地路径或 gh: 定位符；缺省 INFRA_AI_ROOT 或 ~/code/infra-ai）' },
    global: {
      type: 'boolean',
      description: '对账全局层（~/.claude，即 Claude Code 的 user scope）与中心源；只读，输出建议命令',
    },
    json: { type: 'boolean', description: '以单行 JSON 输出到 stdout（机器可读）' },
    target: { type: 'positional', required: false, description: '目标项目目录（缺省当前目录）' },
  },
  async run({ args }) {
    const invalid = validateGlobalArgs({ global: args.global, target: args.target })
    if (invalid !== null) {
      console.error(invalid)
      process.exitCode = 2
      return
    }

    if (args.global === true) {
      const result = await globalStatusReport(defaultContext(), { source: args.source, projectTarget: process.cwd() })
      if (args.json === true) {
        const payload = result.ok
          ? { ok: true, rows: result.rows, duplicates: result.duplicates, exitCode: result.exitCode }
          : { ok: false, message: result.message, exitCode: result.exitCode }
        console.log(renderJson(payload))
      } else {
        if (result.message !== undefined) console.log(result.message)
        for (const row of result.rows) {
          console.log(`${row.rule} ${row.state}`)
          if (row.suggestion !== undefined) console.log(`  建议: ${row.suggestion}`)
        }
        if (result.duplicates.length > 0) {
          console.log(`双层重复（全局与项目都装了，Claude 会加载两遍）: ${result.duplicates.join(', ')}`)
        }
      }
      process.exitCode = result.exitCode
      return
    }

    const result = await statusReport(defaultContext(), {
      source: args.source,
      target: args.target ?? process.cwd(),
    })
    if (args.json === true) {
      const payload = result.ok
        ? { ok: true, rows: result.rows, duplicates: result.duplicates, exitCode: result.exitCode }
        : { ok: false, message: result.message, exitCode: result.exitCode }
      console.log(renderJson(payload))
    } else {
      if (result.message !== undefined) console.log(result.message)
      for (const row of result.rows) console.log(`${row.rule} ${row.state}`)
      if (result.duplicates !== undefined && result.duplicates.length > 0) {
        console.log(`双层重复（全局与项目都装了，Claude 会加载两遍）: ${result.duplicates.join(', ')}`)
      }
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
    add: { type: 'string', description: '显式安装的 rule 名（逗号分隔）；若此前排除则补回（本地有不同内容时默认跳过，--force 覆盖）' },
    remove: { type: 'string', description: '从下游卸载的 rule 名（逗号分隔）：删除本地副本，从 lock.rules 移除并记入 excluded' },
    json: { type: 'boolean', description: '以单行 JSON 输出到 stdout（机器可读）' },
    target: { type: 'positional', required: false, description: '目标项目目录（缺省当前目录）' },
  },
  async run({ args }) {
    const add = splitNames(args.add)
    const remove = splitNames(args.remove)

    const result = await runUpdate(defaultContext(), {
      source: args.source,
      force: args.force ?? false,
      dryRun: args['dry-run'] ?? false,
      target: args.target ?? process.cwd(),
      add,
      remove,
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

const diffCommand = defineCommand({
  meta: {
    name: 'diff',
    description: '对比下游副本与中心源的内容差异。--rule 查看单条完整 diff。有差异退 1，无差异退 0。',
  },
  args: {
    rule: { type: 'string', description: '只看这一条 rule 的完整 diff（可为普通或已排除项）' },
    source: { type: 'string', description: '中心源（本地路径或 gh: 定位符；缺省 INFRA_AI_ROOT 或 ~/code/infra-ai）' },
    global: {
      type: 'boolean',
      description: '对账全局层（~/.claude，即 Claude Code 的 user scope）与中心源；只读，输出建议命令',
    },
    json: { type: 'boolean', description: '以单行 JSON 输出到 stdout（机器可读）' },
    target: { type: 'positional', required: false, description: '目标项目目录（缺省当前目录）' },
  },
  async run({ args }) {
    const invalid = validateGlobalArgs({ global: args.global, target: args.target })
    if (invalid !== null) {
      console.error(invalid)
      process.exitCode = 2
      return
    }

    const result = await diffReport(defaultContext(), {
      source: args.source,
      rule: args.rule,
      target: args.global === true ? homedir() : (args.target ?? process.cwd()),
      global: args.global,
    })
    if (args.json === true) {
      const payload = result.ok ? { ok: true, diffs: result.diffs } : { ok: false, message: result.message }
      console.log(renderJson(payload))
    } else {
      if (result.message !== undefined) console.log(result.message)
      for (const entry of result.diffs) {
        console.log(`${entry.rule} +${entry.additions} -${entry.deletions}`)
        if (entry.patch !== undefined) console.log(entry.patch)
      }
    }
    process.exitCode = result.exitCode
  },
})

const listCommand = defineCommand({
  meta: {
    name: 'list',
    description: '列出中心源 catalog 中的 rule；--tag/--grep 过滤；已初始化目标标注安装状态。恒退 0（源/catalog 解析失败除外）。',
  },
  args: {
    source: { type: 'string', description: '中心源（本地路径或 gh: 定位符；缺省 INFRA_AI_ROOT 或 ~/code/infra-ai）' },
    global: {
      type: 'boolean',
      description: '对账全局层（~/.claude，即 Claude Code 的 user scope）与中心源；只读，输出建议命令',
    },
    tag: { type: 'string', description: '按 tag 过滤（逗号分隔，取交集）' },
    grep: { type: 'string', description: '按名称/描述/正文子串过滤（不区分大小写）' },
    json: { type: 'boolean', description: '以单行 JSON 输出到 stdout（机器可读）' },
    target: { type: 'positional', required: false, description: '目标项目目录（缺省当前目录）' },
  },
  async run({ args }) {
    const invalid = validateGlobalArgs({ global: args.global, target: args.target })
    if (invalid !== null) {
      console.error(invalid)
      process.exitCode = 2
      return
    }

    const tags = splitNames(args.tag)

    const result = await listReport(defaultContext(), {
      source: args.source,
      target: args.global === true ? homedir() : (args.target ?? process.cwd()),
      tags,
      grep: args.grep,
      global: args.global,
    })
    if (args.json === true) {
      const payload = result.ok
        ? { ok: true, rows: result.rows, exitCode: result.exitCode }
        : { ok: false, message: result.message, exitCode: result.exitCode }
      console.log(renderJson(payload))
    } else {
      if (result.message !== undefined) console.log(result.message)
      for (const row of result.rows) {
        console.log([row.name, row.state, row.description].filter((s) => s !== undefined).join('  '))
      }
    }
    process.exitCode = result.exitCode
  },
})

const showCommand = defineCommand({
  meta: {
    name: 'show',
    description: '显示单条 rule 的元数据与正文。名不存在退 1。',
  },
  args: {
    source: { type: 'string', description: '中心源（本地路径或 gh: 定位符；缺省 INFRA_AI_ROOT 或 ~/code/infra-ai）' },
    json: { type: 'boolean', description: '以单行 JSON 输出到 stdout（机器可读）' },
    // citty 的 positional 匹配是纯声明序 FIFO，不看 required——required 的
    // positional 必须先声明，否则被后声明的 optional 挡道（见 iuse show <name> [target] 用法）
    name: { type: 'positional', required: true, description: 'rule 名（见 iuse list）' },
    target: { type: 'positional', required: false, description: '目标项目目录（缺省当前目录）' },
  },
  async run({ args }) {
    const result = await showReport(defaultContext(), {
      source: args.source,
      target: args.target ?? process.cwd(),
      name: args.name,
    })
    if (args.json === true) {
      console.log(renderJson({ ok: result.ok, entry: result.entry, content: result.content }))
    } else {
      if (result.message !== undefined) console.log(result.message)
      if (result.entry !== undefined) {
        const { name, description, tags, scope, profiles, state } = result.entry
        console.log(`name: ${name}`)
        console.log(`description: ${description}`)
        console.log(`tags: ${tags.join(', ')}`)
        console.log(`scope: ${scope}`)
        console.log(`profiles: ${profiles.join(', ')}`)
        if (state !== undefined) console.log(`state: ${state}`)
        if (result.content !== undefined) {
          console.log('')
          console.log(result.content)
        }
      }
    }
    process.exitCode = result.exitCode
  },
})

export function buildMainCommand() {
  return defineCommand({
    meta: {
      name: 'iuse',
      description:
        '从 infra-ai 中心源按 profile 拼装 Claude Code 配置。典型流程：list/show 查阅 -> profiles -> init --dry-run -> init -> status/update。'
        + 'status/diff/list 支持 --global：对账 ~/.claude（Claude 的 user scope）而非某个项目，与 target 互斥，只读。',
    },
    subCommands: {
      init: initCommand,
      profiles: profilesCommand,
      status: statusCommand,
      update: updateCommand,
      diff: diffCommand,
      list: listCommand,
      show: showCommand,
    },
  })
}

/**
 * The TUI is only for a bare `iuse` invocation on an interactive terminal --
 * zero argv and BOTH stdin/stdout are TTYs (an output-only PTY with piped
 * stdin would hang ink's raw-mode input). Anything else (a subcommand, a
 * typo, --help, --json, a stray flag) falls through to citty -- the
 * subcommand surface stays 100% imperative so AI/scripts get a stable
 * contract regardless of terminal allocation.
 */
export async function runCli(opts?: { isTTY?: boolean }): Promise<void> {
  const argv = process.argv.slice(2)
  const isTTY = opts?.isTTY ?? (process.stdout.isTTY === true && process.stdin.isTTY === true)
  if (argv.length === 0 && isTTY) {
    const { runTui } = await import('../tui/app')
    await runTui({ ctx: defaultContext(), target: process.cwd() })
    return
  }
  await runMain(buildMainCommand())
}
