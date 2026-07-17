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
      'Assemble a profile into a target project (rules + settings + AI-instantiated CLAUDE.md/architecture). Use --dry-run to preview. Exit 0 on success.',
  },
  args: {
    profile: { type: 'string', required: true, description: 'profile name to assemble' },
    source: { type: 'string', description: 'infra-ai source (local path or gh: locator)' },
    force: { type: 'boolean', description: 'reinitialize, overwrite, and re-instantiate even if already applied' },
    'dry-run': { type: 'boolean', description: 'print the planned steps without writing anything' },
    json: { type: 'boolean', description: 'print machine-readable JSON to stdout instead of text' },
    target: { type: 'positional', required: false, description: 'target project directory (default: cwd)' },
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
    description: 'List profiles available in the central source with their rules. Exit 0.',
  },
  args: {
    source: { type: 'string', description: 'infra-ai source (local path or gh: locator)' },
    json: { type: 'boolean', description: 'print machine-readable JSON to stdout instead of text' },
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
      'Report per-rule drift (synced/modified/outdated/missing) against the source. Exit 1 when anything needs attention, 0 when clean.',
  },
  args: {
    source: { type: 'string', description: 'infra-ai source (local path or gh: locator)' },
    json: { type: 'boolean', description: 'print machine-readable JSON to stdout instead of text' },
    target: { type: 'positional', required: false, description: 'target project directory (default: cwd)' },
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
      'Apply source changes to an initialized target; locally modified copies are skipped unless --force. Use --dry-run to preview. Exit 0 on success.',
  },
  args: {
    source: { type: 'string', description: 'infra-ai source (local path or gh: locator)' },
    force: { type: 'boolean', description: 'overwrite locally modified or missing rule files' },
    'dry-run': { type: 'boolean', description: 'print the planned steps without applying anything' },
    json: { type: 'boolean', description: 'print machine-readable JSON to stdout instead of text' },
    target: { type: 'positional', required: false, description: 'target project directory (default: cwd)' },
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
        'Assemble Claude Code config from the infra-ai central source by profile. Typical flow: profiles -> init --dry-run -> init -> status/update.',
    },
    subCommands: { init: initCommand, profiles: profilesCommand, status: statusCommand, update: updateCommand },
  })
}

export async function runCli(): Promise<void> {
  await runMain(buildMainCommand())
}
