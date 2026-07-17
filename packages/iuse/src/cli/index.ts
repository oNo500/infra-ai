import { homedir } from 'node:os'
import { join } from 'node:path'
import { defineCommand, runMain } from 'citty'
import { downloadTemplate } from 'giget'
import { runClaude, runCommand } from '@infra-ai/meta-cli/core'
import type { IuseContext } from '../core/init'
import { runInit } from '../core/init'

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
    target: { type: 'positional', required: false, description: 'target project directory (default: cwd)' },
  },
  async run({ args }) {
    const result = await runInit(defaultContext(), {
      profile: args.profile,
      source: args.source,
      force: args.force ?? false,
      target: args.target ?? process.cwd(),
    })
    console.log(result.message)
    if (!result.ok) process.exitCode = 1
  },
})

export function buildMainCommand() {
  return defineCommand({
    meta: { name: 'iuse', description: 'assemble infra-ai profiles into target projects' },
    subCommands: { init: initCommand },
  })
}

export async function runCli(): Promise<void> {
  await runMain(buildMainCommand())
}
