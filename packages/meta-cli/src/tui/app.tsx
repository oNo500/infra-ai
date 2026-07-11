import { useCallback, useMemo, useState } from 'react'
import { Box, Text, useApp, useInput } from 'ink'
import { defaultContext, getAction } from '../core/actions'
import { loadOverview } from '../core/overview'
import type { OverviewRow } from '../core/overview'
import { AssetDetail } from './asset-detail'
import { AssetList } from './asset-list'
import { RunPanel } from './run-panel'
import type { Job } from './run-panel'
import { SkillsView } from './skills-view'
import { TargetsView } from './targets-view'

export function App({ repoRoot }: { repoRoot: string }) {
  const { exit } = useApp()
  const ctx = useMemo(() => defaultContext(repoRoot), [repoRoot])
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
        .catch((error) => setJob((j) => (j ? { ...j, done: true, error: String(error) } : j)))
        .finally(reload)
    },
    [reload],
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
      runJob(`dist ${row.asset.name}`, (onText) =>
        getAction('dist')
          .execute(ctx, { positionals: [row.asset.name], flags: {} }, { onText })
          .then((r) => {
            if (r.ok && r.message) onText(r.message)
            return r.ok ? null : (r.message ?? 'failed')
          }),
      )
    }
    if (input === 'D') {
      runJob('dist all pending', (onText) =>
        getAction('dist')
          .execute(ctx, { positionals: [], flags: { all: true } }, { onText })
          .then((r) => {
            if (r.ok && r.message) onText(r.message)
            return r.ok ? null : (r.message ?? 'failed')
          }),
      )
    }

    if (input === 'a' && row.status === 'untracked') {
      runJob(`adopt ${row.asset.name}`, (onText) =>
        getAction('adopt')
          .execute(ctx, { positionals: [row.asset.name], flags: {} })
          .then((r) => {
            if (r.ok && r.message) onText(r.message)
            return r.ok ? null : (r.message ?? 'failed')
          }),
      )
    }
    if (input === 'b' && row.status !== 'stub') {
      runJob(`build ${row.asset.name}`, (onText) =>
        getAction('build')
          .execute(ctx, { positionals: [row.asset.name], flags: {} }, { onText })
          .then((r) => {
            if (r.ok && r.message) onText(r.message)
            return r.ok ? null : (r.message ?? 'failed')
          }),
      )
    }
    if (input === 'B') {
      runJob('build stale assets', (onText) =>
        getAction('build')
          .execute(ctx, { positionals: [], flags: { stale: true } }, { onText })
          .then((r) => {
            if (r.ok && r.message) onText(r.message)
            return r.ok ? null : (r.message ?? 'failed')
          }),
      )
    }
    if (input === 'w' && row.status === 'dirty') {
      runJob(`writeback ${row.asset.name}`, (onText) =>
        getAction('writeback')
          .execute(ctx, { positionals: [row.asset.name], flags: {} }, { onText })
          .then((r) => {
            if (r.ok && r.message) onText(r.message)
            return r.ok ? null : (r.message ?? 'failed')
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
            ctx={ctx}
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
            states={rows[selected].targets}
            onExit={() => setView('assets')}
          />
        )}
        {view === 'assets' && <AssetList rows={rows} selected={selected} />}
        {view === 'skills' && (
          <SkillsView repoRoot={repoRoot} ctx={ctx} onExit={() => setView('assets')} />
        )}
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
