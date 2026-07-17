import { defineCommand, runMain } from 'citty'

export function buildMainCommand() {
  return defineCommand({
    meta: { name: 'iuse', description: 'assemble infra-ai profiles into target projects' },
    subCommands: {},
  })
}

export async function runCli(): Promise<void> {
  await runMain(buildMainCommand())
}
