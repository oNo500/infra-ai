import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import matter from 'gray-matter'
import type { CommandRunner } from './io'
import { loadSkills, saveSkills } from './registry'
import type { SkillEntry } from './registry'

export interface LedgerIssue {
  dir: string
  kind: 'name-mismatch' | 'unledgered'
  detail: string
}

function scanSkillDirs(repoRoot: string): { dir: string; fmName: string }[] {
  const skillsDir = join(repoRoot, 'skills')
  if (!existsSync(skillsDir)) return []
  return readdirSync(skillsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(skillsDir, e.name, 'SKILL.md')))
    .map((e) => {
      const { data } = matter(readFileSync(join(skillsDir, e.name, 'SKILL.md'), 'utf8'))
      return { dir: e.name, fmName: typeof data.name === 'string' ? data.name : '' }
    })
    .toSorted((a, b) => a.dir.localeCompare(b.dir))
}

function ledgerIssues(repoRoot: string): LedgerIssue[] {
  const ledger = loadSkills(repoRoot)
  const named = new Set(ledger.map((s) => s.name))
  const issues: LedgerIssue[] = []
  for (const { dir, fmName } of scanSkillDirs(repoRoot)) {
    if (fmName !== dir) {
      issues.push({
        dir,
        kind: 'name-mismatch',
        detail: `frontmatter name '${fmName}' != directory name`,
      })
    } else if (!named.has(dir)) {
      issues.push({ dir, kind: 'unledgered', detail: 'missing from skills.json' })
    }
  }
  return issues
}

export function checkSkillsLedger(repoRoot: string): LedgerIssue[] {
  return ledgerIssues(repoRoot)
}

export function fixSkillsLedger(repoRoot: string): { added: string[]; issues: LedgerIssue[] } {
  const issues = ledgerIssues(repoRoot)
  const toAdd = issues.filter((i) => i.kind === 'unledgered').map((i) => i.dir)
  if (toAdd.length > 0) {
    const ledger = loadSkills(repoRoot)
    saveSkills(repoRoot, [
      ...ledger,
      ...toAdd.map((name): SkillEntry => ({ name, source: 'custom' })),
    ])
  }
  return { added: toAdd, issues: issues.filter((i) => i.kind !== 'unledgered') }
}

export interface MirrorStatus {
  name: string
  localCommit: string
  remoteCommit: string
  outdated: boolean
}

export async function checkMirrors(
  skills: SkillEntry[],
  run: CommandRunner,
): Promise<MirrorStatus[]> {
  const mirrors = skills.filter((s) => s.source === 'mirror')
  const statuses: MirrorStatus[] = []
  for (const m of mirrors) {
    const res = await run('gh', [
      'api',
      `repos/${m.repo}/commits?path=${m.path}`,
      '--jq',
      '.[0].sha',
    ])
    if (res.code !== 0) throw new Error(`gh api failed for ${m.name}: ${res.stderr}`)
    const remoteCommit = res.stdout.trim()
    statuses.push({
      name: m.name,
      localCommit: m.commit ?? '',
      remoteCommit,
      outdated: remoteCommit !== m.commit,
    })
  }
  return statuses
}

export async function updateMirror(
  repoRoot: string,
  status: MirrorStatus,
  run: CommandRunner,
  today: string,
): Promise<void> {
  const ledger = loadSkills(repoRoot)
  const entry = ledger.find((s) => s.name === status.name)
  if (!entry || entry.source !== 'mirror') throw new Error(`not a mirror skill: ${status.name}`)
  const res = await run('pnpx', [
    'giget',
    `gh:${entry.repo}/${entry.path}`,
    join(repoRoot, 'skills', entry.name),
    '--force',
  ])
  if (res.code !== 0) throw new Error(`giget failed for ${status.name}: ${res.stderr}`)
  saveSkills(
    repoRoot,
    ledger.map((s) =>
      s.name === status.name
        ? Object.assign({}, s, { commit: status.remoteCommit, updated: today })
        : s,
    ),
  )
}

export interface Recommendation {
  name: string
  repo: string
}

export function officialRecommendations(skills: SkillEntry[]): Recommendation[] {
  return skills
    .filter((s) => s.source === 'official')
    .map((s) => ({ name: s.name, repo: s.repo ?? '' }))
}

export async function listInstalledSkills(run: CommandRunner): Promise<string[]> {
  const res = await run('pnpx', ['skills', 'ls'])
  if (res.code !== 0) throw new Error(`pnpx skills ls failed: ${res.stderr}`)
  return res.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}
