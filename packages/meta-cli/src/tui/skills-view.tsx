import { useEffect, useRef, useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { runCommand } from '../core/io'
import { loadSkills } from '../core/registry'
import {
  checkMirrors,
  checkSkillsLedger,
  fixSkillsLedger,
  listInstalledSkills,
  officialRecommendations,
  updateMirror,
} from '../core/skills-sync'
import type { LedgerIssue, MirrorStatus, Recommendation } from '../core/skills-sync'

export function SkillsView({ repoRoot, onExit }: { repoRoot: string; onExit: () => void }) {
  const [issues, setIssues] = useState<LedgerIssue[]>(() => checkSkillsLedger(repoRoot))
  const [mirrors, setMirrors] = useState<MirrorStatus[] | null>(null)
  const [mirrorError, setMirrorError] = useState<string | null>(null)
  const [installed, setInstalled] = useState<string[] | null>(null)
  const [installedError, setInstalledError] = useState<string | null>(null)
  const [recommended] = useState<Recommendation[]>(() =>
    officialRecommendations(loadSkills(repoRoot)),
  )
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    checkMirrors(loadSkills(repoRoot), runCommand).then(
      (result) => {
        if (!cancelled) setMirrors(result)
      },
      (error) => {
        if (!cancelled) setMirrorError(String(error))
      },
    )
    return () => {
      cancelled = true
    }
  }, [repoRoot])

  useEffect(() => {
    let cancelled = false
    listInstalledSkills(runCommand).then(
      (result) => {
        if (!cancelled) setInstalled(result)
      },
      (error) => {
        if (!cancelled) setInstalledError(String(error))
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

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
          await updateMirror(repoRoot, m, today)
        }
        const next = await checkMirrors(loadSkills(repoRoot), runCommand)
        if (!mountedRef.current) return
        setMirrors(next)
        setNotice(`updated: ${outdated.map((m) => m.name).join(', ')}`)
      })()
        .catch((error) => {
          if (mountedRef.current) setNotice(String(error))
        })
        .finally(() => {
          if (mountedRef.current) setBusy(false)
        })
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
      <Box marginTop={1} flexDirection="column">
        <Text bold>installed</Text>
        {installed === null && !installedError && <Text dimColor>loading...</Text>}
        {installedError && <Text color="red">{installedError}</Text>}
        {installed?.map((line, i) => <Text key={`${line}-${i}`}>{line}</Text>)}
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text bold>recommended</Text>
        {recommended.length === 0 && <Text dimColor>none</Text>}
        {recommended.map((r) => (
          <Text key={r.name} dimColor>
            {r.name}  pnpx skills add {r.repo}
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
