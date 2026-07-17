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

const initCommand = defineCommand({
  meta: { name: 'init', description: 'assemble a profile into a target project' },
  args: {
    profile: { type: 'string', required: true, description: 'profile name to assemble' },
    source: { type: 'string', description: 'infra-ai source (local path or gh: locator)' },
    force: { type: 'boolean', description: 'reinitialize, overwrite, and re-instantiate even if already applied' },
    'dry-run': { type: 'boolean', description: 'print the planned steps without writing anything' },
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
    console.log(result.message)
    if (!result.ok) process.exitCode = 1
  },
})

const profilesCommand = defineCommand({
  meta: { name: 'profiles', description: 'list available profiles in a source' },
  args: {
    source: { type: 'string', description: 'infra-ai source (local path or gh: locator)' },
  },
  async run({ args }) {
    const result = await profilesReport(defaultContext(), {
      source: args.source,
    })
    if (result.message !== undefined) console.log(result.message)
    if (result.profilesText !== undefined) console.log(result.profilesText)
    process.exitCode = result.exitCode
  },
})

const statusCommand = defineCommand({
  meta: { name: 'status', description: 'report drift between the target and the source profile' },
  args: {
    source: { type: 'string', description: 'infra-ai source (local path or gh: locator)' },
    target: { type: 'positional', required: false, description: 'target project directory (default: cwd)' },
  },
  async run({ args }) {
    const result = await statusReport(defaultContext(), {
      source: args.source,
      target: args.target ?? process.cwd(),
    })
    if (result.message !== undefined) console.log(result.message)
    for (const row of result.rows) console.log(`${row.rule} ${row.state}`)
    process.exitCode = result.exitCode
  },
})

const updateCommand = defineCommand({
  meta: { name: 'update', description: 'apply source changes to an initialized target' },
  args: {
    source: { type: 'string', description: 'infra-ai source (local path or gh: locator)' },
    force: { type: 'boolean', description: 'overwrite locally modified or missing rule files' },
    'dry-run': { type: 'boolean', description: 'print the planned steps without applying anything' },
    target: { type: 'positional', required: false, description: 'target project directory (default: cwd)' },
  },
  async run({ args }) {
    const result = await runUpdate(defaultContext(), {
      source: args.source,
      force: args.force ?? false,
      dryRun: args['dry-run'] ?? false,
      target: args.target ?? process.cwd(),
    })
    console.log(result.message)
    if (!result.ok) process.exitCode = 1
  },
})

export function buildMainCommand() {
  return defineCommand({
    meta: { name: 'iuse', description: 'assemble infra-ai profiles into target projects' },
    subCommands: { init: initCommand, profiles: profilesCommand, status: statusCommand, update: updateCommand },
  })
}

export async function runCli(): Promise<void> {
  await runMain(buildMainCommand())
}
