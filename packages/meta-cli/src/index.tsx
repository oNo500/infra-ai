import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { render } from 'ink'
import { App } from './tui/App'

const repoRoot = process.cwd()
if (!existsSync(join(repoRoot, 'skills.json'))) {
  console.error('meta-cli must run from the infra-ai repo root (skills.json not found)')
  process.exit(1)
}

render(<App repoRoot={repoRoot} />)
