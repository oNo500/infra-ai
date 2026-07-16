import type { SkillsStatusData, StatusData } from '../core/actions'

export function renderStatus(data: StatusData): string {
  const lines =
    data.rows.length === 0
      ? ['no assets']
      : data.rows.map((r) => `${r.name.padEnd(20)} ${r.kind.padEnd(8)} ${r.status.padEnd(10)}`.trimEnd())
  for (const v of data.violations) lines.push(`violation: ${v}`)
  return lines.join('\n')
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
