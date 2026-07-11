import { useEffect, useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { runCommand } from '../core/io'
import { loadSkills } from '../core/registry'
import {
  checkMirrors,
  checkSkillsLedger,
  fixSkillsLedger,
  updateMirror,
  type LedgerIssue,
  type MirrorStatus,
} from '../core/skills-sync'

export function SkillsView({ repoRoot, onExit }: { repoRoot: string; onExit: () => void }) {
  const [issues, setIssues] = useState<LedgerIssue[]>(() => checkSkillsLedger(repoRoot))
  const [mirrors, setMirrors] = useState<MirrorStatus[] | null>(null)
  const [mirrorError, setMirrorError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    checkMirrors(loadSkills(repoRoot), runCommand).then(setMirrors, (e) =>
      setMirrorError(String(e)),
    )
  }, [repoRoot])

  useInput((input, key) => {
    if (busy) return
    if (key.escape || input === 's') onExit()
    if (input === 'f') {
      const result = fixSkillsLedger(repoRoot)
      setIssues(result.issues)
      setNotice(result.added.length > 0 ? `added: ${result.added.join(', ')}` : 'nothing to fix')
    }
    if (input === 'u' && mirrors) {
      const outdated = mirrors.filter((m) => m.outdated)
      if (outdated.length === 0) {
        setNotice('all mirrors up-to-date')
        return
      }
      setBusy(true)
      const today = new Date().toISOString().slice(0, 10)
      ;(async () => {
        for (const m of outdated) {
          await updateMirror(repoRoot, m, runCommand, today)
        }
        setMirrors(await checkMirrors(loadSkills(repoRoot), runCommand))
        setNotice(`updated: ${outdated.map((m) => m.name).join(', ')}`)
      })()
        .catch((e) => setNotice(String(e)))
        .finally(() => setBusy(false))
    }
  })

  return (
    <Box flexDirection="column">
      <Text bold>skills ledger</Text>
      {issues.map((i) => (
        <Text key={i.dir} color={i.kind === 'name-mismatch' ? 'red' : 'yellow'}>
          [{i.kind}] {i.dir}: {i.detail}
        </Text>
      ))}
      {issues.length === 0 && <Text color="green">ledger clean</Text>}
      <Box marginTop={1} flexDirection="column">
        <Text bold>mirrors</Text>
        {mirrors === null && !mirrorError && <Text dimColor>checking upstreams...</Text>}
        {mirrorError && <Text color="red">{mirrorError}</Text>}
        {mirrors?.map((m) => (
          <Text key={m.name} color={m.outdated ? 'yellow' : 'green'}>
            [{m.outdated ? 'outdated' : 'up-to-date'}] {m.name}
            {m.outdated ? ` ${m.localCommit.slice(0, 7)} -> ${m.remoteCommit.slice(0, 7)}` : ''}
          </Text>
        ))}
      </Box>
      {notice && (
        <Box marginTop={1}>
          <Text>{notice}</Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text dimColor>{busy ? 'updating...' : 'f fix ledger  u update mirrors  s/Esc back'}</Text>
      </Box>
    </Box>
  )
}
