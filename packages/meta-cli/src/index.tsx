import { existsSync } from 'node:fs'
import { join } from 'node:path'

const repoRoot = process.cwd()
if (!existsSync(join(repoRoot, 'skills.json'))) {
  console.error('meta-cli must run from the infra-ai repo root (skills.json not found)')
  process.exit(1)
}

if (process.argv.length > 2) {
  const { runCli } = await import('./cli/index')
  await runCli()
} else {
  const { render } = await import('ink')
  const { App } = await import('./tui/app')
  render(<App repoRoot={repoRoot} />)
}
