import { useEffect, useRef, useState } from 'react'
import { Box, Text, useInput } from 'ink'
import type { ActionContext } from '../core/actions'
import { runAction } from '../core/actions'
import { runCommand } from '../core/io'
import { loadSkills } from '../core/registry'
import {
  checkMirrors,
  checkSkillsLedger,
  listInstalledSkills,
  officialRecommendations,
} from '../core/skills-sync'
import type { LedgerIssue, MirrorStatus, Recommendation } from '../core/skills-sync'

export function SkillsView({
  repoRoot,
  ctx,
  onExit,
}: {
  repoRoot: string
  ctx: ActionContext
  onExit: () => void
}) {
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
      void runAction(ctx, 'skills:fix', { positionals: [], flags: {} }).then((r) => {
        if (mountedRef.current) {
          setIssues(checkSkillsLedger(repoRoot))
          setNotice(r.ok ? (r.message ?? null) : `${r.message ?? 'failed'}（log: ${r.logPath ?? ''}）`)
        }
      })
    }
    if (input === 'u' && mirrors) {
      setBusy(true)
      void runAction(
        ctx,
        'skills:update',
        { positionals: [], flags: {} },
        { onText: (t) => mountedRef.current && setNotice(t) },
      )
        .then((r) => {
          if (!mountedRef.current) return
          setNotice(r.ok ? (r.message ?? null) : `${r.message ?? 'failed'}（log: ${r.logPath ?? ''}）`)
          return checkMirrors(loadSkills(repoRoot), runCommand).then((m) => {
            if (mountedRef.current) setMirrors(m)
          })
        })
        .catch((error) => mountedRef.current && setNotice(String(error)))
        .finally(() => mountedRef.current && setBusy(false))
    }
  })

  return (
    <Box flexDirection="column">
      <Text bold>skills 清单核对</Text>
      {issues.map((i) => (
        <Text key={i.dir} color={i.kind === 'name-mismatch' ? 'red' : 'yellow'}>
          [{i.kind}] {i.dir}: {i.detail}
        </Text>
      ))}
      {issues.length === 0 && <Text color="green">清单与目录一致</Text>}
      <Box marginTop={1} flexDirection="column">
        <Text bold>mirror 上游</Text>
        {mirrors === null && !mirrorError && <Text dimColor>检查上游中...</Text>}
        {mirrorError && <Text color="red">{mirrorError}</Text>}
        {mirrors?.map((m) => (
          <Text key={m.name} color={m.outdated ? 'yellow' : 'green'}>
            [{m.outdated ? '过期' : '最新'}] {m.name}
            {m.outdated ? ` ${m.localCommit.slice(0, 7)} -> ${m.remoteCommit.slice(0, 7)}` : ''}
          </Text>
        ))}
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text bold>已安装</Text>
        {installed === null && !installedError && <Text dimColor>加载中...</Text>}
        {installedError && <Text color="red">{installedError}</Text>}
        {installed?.map((line, i) => <Text key={`${line}-${i}`}>{line}</Text>)}
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text bold>精选推荐</Text>
        {recommended.length === 0 && <Text dimColor>无</Text>}
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
        <Text dimColor>{busy ? '更新中...' : 'f 补齐清单  u 更新 mirror  s/Esc 返回'}</Text>
      </Box>
    </Box>
  )
}
