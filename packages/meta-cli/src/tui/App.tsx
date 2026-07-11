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
import { distribute, downstreamStates, subscribers } from '../core/dist'
import { loadOverview, type OverviewRow } from '../core/overview'
import { loadLock, loadTargets, saveLock } from '../core/registry'
import { adoptEntry, gatherFacts, lockKey } from '../core/status'
import { AssetDetail } from './AssetDetail'
import { AssetList } from './AssetList'
import { RunPanel, type Job } from './RunPanel'
import { SkillsView } from './SkillsView'
import { TargetsView } from './TargetsView'

export function App({ repoRoot }: { repoRoot: string }) {
  const { exit } = useApp()
  const [rows, setRows] = useState<OverviewRow[]>(() => loadOverview(repoRoot))
  const [selected, setSelected] = useState(0)
  const [job, setJob] = useState<Job | null>(null)
  const [confirmQuit, setConfirmQuit] = useState(false)
  const [view, setView] = useState<'assets' | 'targets' | 'detail' | 'skills'>('assets')

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

  const builtRules = rows
    .filter((r) => r.asset.kind === 'rule' && r.status !== 'stub' && r.status !== 'unbuilt')
    .map((r) => r.asset.name)

  // Ink dispatches every keypress to all mounted useInput handlers, so
  // sub-views (TargetsView, SkillsView) receive keys alongside App. App must
  // bail out immediately for non-assets views; sub-views own their own exit
  // keys (Esc/t/s/Enter) and App's q/confirmQuit must never fire for them.
  useInput((input, key) => {
    if (running) return
    if (view !== 'assets') return
    if (input === 'q') {
      if (confirmQuit || !job) exit()
      setConfirmQuit(true)
      return
    }
    setConfirmQuit(false)
    if (input === 't') {
      setView('targets')
      return
    }
    if (input === 's') {
      setView('skills')
      return
    }
    if (input === 'r') reload()
    if (key.upArrow) setSelected((s) => Math.max(0, s - 1))
    if (key.downArrow) setSelected((s) => Math.min(rows.length - 1, s + 1))

    const row = rows[selected]
    if (!row) return

    if (key.return && row) {
      setView('detail')
      return
    }
    if (input === 'd' && row.asset.kind === 'rule') {
      const targets = loadTargets(repoRoot)
      const subs = subscribers(targets, row.asset.name)
      runJob(`dist ${row.asset.name} to ${subs.length} targets`, async (onText) => {
        for (const target of subs) {
          distribute(repoRoot, row.asset, target)
          onText(`copied to ${target.path}`)
        }
        return null
      })
    }
    if (input === 'D') {
      const targets = loadTargets(repoRoot)
      const pending = rows.filter(
        (r) => r.asset.kind === 'rule' && r.downstream.drift + r.downstream.missing > 0,
      )
      if (pending.length === 0) return
      runJob(`dist ${pending.length} assets`, async (onText) => {
        for (const r of pending) {
          for (const { target, state } of downstreamStates(repoRoot, r.asset, targets)) {
            if (state === 'synced') continue
            distribute(repoRoot, r.asset, target)
            onText(`${r.asset.name} -> ${target.path}`)
          }
        }
        return null
      })
    }

    if (input === 'a' && row.status === 'untracked') {
      const facts = gatherFacts(repoRoot, row.asset, loadLock(repoRoot))
      if (facts.artifactHash !== null) {
        const lock = loadLock(repoRoot)
        saveLock(repoRoot, {
          ...lock,
          [lockKey(row.asset)]: adoptEntry(
            facts.metaHash,
            facts.artifactHash,
            new Date().toISOString(),
          ),
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
        {view === 'targets' && (
          <TargetsView
            repoRoot={repoRoot}
            rules={builtRules}
            onExit={() => {
              setView('assets')
              reload()
            }}
          />
        )}
        {view === 'detail' && rows[selected] && (
          <AssetDetail
            row={rows[selected]}
            states={downstreamStates(repoRoot, rows[selected].asset, loadTargets(repoRoot))}
            onExit={() => setView('assets')}
          />
        )}
        {view === 'assets' && <AssetList rows={rows} selected={selected} />}
        {view === 'skills' && <SkillsView repoRoot={repoRoot} onExit={() => setView('assets')} />}
      </Box>
      {job && (
        <Box marginTop={1}>
          <RunPanel job={job} />
        </Box>
      )}
      {view === 'assets' && (
        <Box marginTop={1}>
          <Text dimColor>
            {confirmQuit
              ? 'press q again to quit'
              : 'up/down move  Enter detail  a adopt  b build  B build stale  w writeback  d dist  D dist all  t targets  s skills  r reload  q quit'}
          </Text>
        </Box>
      )}
    </Box>
  )
}
