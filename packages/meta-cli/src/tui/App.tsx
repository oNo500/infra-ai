import { useCallback, useState } from 'react'
import { Box, Text, useApp, useInput } from 'ink'
import {
  allowedToolsFor,
  buildPromptFor,
  recordBuild,
  runClaude,
  verifyBuild,
  writebackPromptFor,
} from '../core/claude'
import { loadOverview, type OverviewRow } from '../core/overview'
import { loadLock, saveLock } from '../core/registry'
import { adoptEntry, gatherFacts } from '../core/status'
import { AssetList } from './AssetList'
import { RunPanel, type Job } from './RunPanel'

export function App({ repoRoot }: { repoRoot: string }) {
  const { exit } = useApp()
  const [rows, setRows] = useState<OverviewRow[]>(() => loadOverview(repoRoot))
  const [selected, setSelected] = useState(0)
  const [job, setJob] = useState<Job | null>(null)
  const [confirmQuit, setConfirmQuit] = useState(false)

  const reload = useCallback(() => {
    const next = loadOverview(repoRoot)
    setRows(next)
    setSelected((s) => Math.min(s, Math.max(0, next.length - 1)))
  }, [repoRoot])

  const running = job !== null && !job.done

  const runJob = useCallback(
    (title: string, fn: (onText: (t: string) => void) => Promise<string | null>) => {
      setJob({ title, lines: [], done: false, error: null })
      const onText = (t: string) =>
        setJob((j) => (j ? { ...j, lines: [...j.lines, ...t.split('\n')] } : j))
      fn(onText)
        .then((error) => setJob((j) => (j ? { ...j, done: true, error } : j)))
        .catch((e) => setJob((j) => (j ? { ...j, done: true, error: String(e) } : j)))
        .finally(reload)
    },
    [reload],
  )

  const buildOne = useCallback(
    (row: OverviewRow, onText: (t: string) => void): Promise<string | null> =>
      runClaude({
        repoRoot,
        prompt: buildPromptFor(row.asset),
        allowedTools: allowedToolsFor(row.asset, 'build'),
        onText,
      }).then((res) => {
        if (res.timedOut) return 'claude timed out'
        if (res.code !== 0) return `claude exited ${res.code}: ${res.stderr.slice(-500)}`
        const err = verifyBuild(repoRoot, row.asset)
        if (err) return err
        recordBuild(repoRoot, row.asset, new Date().toISOString())
        return null
      }),
    [repoRoot],
  )

  useInput((input, key) => {
    if (running) return
    if (input === 'q') {
      if (job && !job.done) return
      if (confirmQuit || !job) exit()
      setConfirmQuit(true)
      return
    }
    setConfirmQuit(false)
    if (input === 'r') reload()
    if (key.upArrow) setSelected((s) => Math.max(0, s - 1))
    if (key.downArrow) setSelected((s) => Math.min(rows.length - 1, s + 1))

    const row = rows[selected]
    if (!row) return

    if (input === 'a' && row.status === 'untracked') {
      const facts = gatherFacts(repoRoot, row.asset, loadLock(repoRoot))
      if (facts.artifactHash !== null) {
        const lock = loadLock(repoRoot)
        saveLock(repoRoot, {
          ...lock,
          [row.asset.name]: adoptEntry(facts.metaHash, facts.artifactHash, new Date().toISOString()),
        })
        reload()
      }
    }
    if (input === 'b' && row.status !== 'stub') {
      runJob(`build ${row.asset.name}`, (onText) => buildOne(row, onText))
    }
    if (input === 'B') {
      const stale = rows.filter((r) => r.status === 'stale')
      if (stale.length === 0) return
      runJob(`build ${stale.length} stale assets`, async (onText) => {
        for (const r of stale) {
          onText(`--- ${r.asset.name} ---`)
          const err = await buildOne(r, onText)
          if (err) return `${r.asset.name}: ${err}`
        }
        return null
      })
    }
    if (input === 'w' && row.status === 'dirty') {
      runJob(`writeback ${row.asset.name}`, (onText) =>
        runClaude({
          repoRoot,
          prompt: writebackPromptFor(row.asset),
          allowedTools: allowedToolsFor(row.asset, 'writeback'),
          onText,
        }).then((res) => {
          if (res.timedOut) return 'claude timed out'
          if (res.code !== 0) return `claude exited ${res.code}: ${res.stderr.slice(-500)}`
          return null
        }),
      )
    }
  })

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>infra-ai meta</Text>
      <Box marginTop={1}>
        <AssetList rows={rows} selected={selected} />
      </Box>
      {job && (
        <Box marginTop={1}>
          <RunPanel job={job} />
        </Box>
      )}
      <Box marginTop={1}>
        <Text dimColor>
          {confirmQuit
            ? 'press q again to quit'
            : 'up/down move  a adopt  b build  B build stale  w writeback  r reload  q quit'}
        </Text>
      </Box>
    </Box>
  )
}
