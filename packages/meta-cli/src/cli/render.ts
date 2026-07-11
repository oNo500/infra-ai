import type { SkillsStatusData, StatusRowData } from '../core/actions'
import type { Target } from '../core/registry'

function downstreamSummary(row: StatusRowData): string {
  if (row.kind !== 'rule') return ''
  const d = row.downstream
  if (d.synced + d.drift + d.missing === 0) return 'no subscribers'
  const parts: string[] = []
  if (d.synced > 0) parts.push(`${d.synced} synced`)
  if (d.drift > 0) parts.push(`${d.drift} drift`)
  if (d.missing > 0) parts.push(`${d.missing} missing`)
  return parts.join(', ')
}

export function renderStatus(rows: StatusRowData[]): string {
  if (rows.length === 0) return 'no assets'
  return rows
    .map((r) => `${r.name.padEnd(20)} ${r.kind.padEnd(8)} ${r.status.padEnd(10)} ${downstreamSummary(r)}`.trimEnd())
    .join('\n')
}

export function renderTargets(targets: Target[]): string {
  if (targets.length === 0) return 'no targets'
  return targets.map((t) => `${t.path}  [${t.subscriptions.join(', ')}]`).join('\n')
}

export function renderSkills(data: SkillsStatusData): string {
  const lines: string[] = ['ledger']
  if (data.issues.length === 0) lines.push('  ledger clean')
  for (const issue of data.issues) lines.push(`  [${issue.kind}] ${issue.dir}: ${issue.detail}`)
  lines.push('mirrors')
  if (data.mirrors.length === 0) lines.push('  no mirrors')
  for (const m of data.mirrors) {
    lines.push(
      m.outdated
        ? `  [outdated] ${m.name} ${m.localCommit.slice(0, 7)} -> ${m.remoteCommit.slice(0, 7)}`
        : `  [up-to-date] ${m.name}`,
    )
  }
  lines.push('installed')
  for (const s of data.installed) lines.push(`  ${s}`)
  lines.push('recommended')
  if (data.recommendations.length === 0) lines.push('  none')
  for (const r of data.recommendations) lines.push(`  ${r.name.padEnd(24)} pnpx skills add ${r.repo}`)
  return lines.join('\n')
}
