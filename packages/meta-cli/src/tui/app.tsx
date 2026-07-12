import { useCallback, useMemo, useState } from 'react'
import { Box, Text, useApp, useInput } from 'ink'
import { defaultContext, runAction } from '../core/actions'
import { loadOverview } from '../core/overview'
import type { OverviewRow } from '../core/overview'
import { AssetDetail } from './asset-detail'
import { AssetList } from './asset-list'
import { RunPanel } from './run-panel'
import type { Job } from './run-panel'
import { SkillsView } from './skills-view'

export function App({ repoRoot }: { repoRoot: string }) {
  const { exit } = useApp()
  const ctx = useMemo(() => defaultContext(repoRoot), [repoRoot])
  const [rows, setRows] = useState<OverviewRow[]>(() => loadOverview(repoRoot))
  const [selected, setSelected] = useState(0)
  const [job, setJob] = useState<Job | null>(null)
  const [confirmQuit, setConfirmQuit] = useState(false)
  const [view, setView] = useState<'assets' | 'detail' | 'skills'>('assets')

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

  // Ink dispatches every keypress to all mounted useInput handlers, so
  // sub-views (SkillsView) receive keys alongside App. App must bail out
  // immediately for non-assets views; sub-views own their own exit keys
  // (Esc/s/Enter) and App's q/confirmQuit must never fire for them.
  useInput((input, key) => {
    if (running) return
    if (view !== 'assets') return
    if (input === 'q') {
      if (confirmQuit || !job) exit()
      setConfirmQuit(true)
      return
    }
    setConfirmQuit(false)
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

    if (input === 'a' && row.status === 'untracked') {
      runJob(`收编 ${row.asset.name}`, (onText) =>
        runAction(ctx, 'adopt', { positionals: [row.asset.name], flags: {} }).then((r) => {
          if (r.ok && r.message) onText(r.message)
          return r.ok ? null : `${r.message ?? 'failed'}${r.logPath ? `\nlog: ${r.logPath}` : ''}`
        }),
      )
    }
    if (input === 'b' && row.status !== 'stub') {
      runJob(`构建 ${row.asset.name}`, (onText) =>
        runAction(ctx, 'build', { positionals: [row.asset.name], flags: {} }, { onText }).then((r) => {
          if (r.ok && r.message) onText(r.message)
          return r.ok ? null : `${r.message ?? 'failed'}${r.logPath ? `\nlog: ${r.logPath}` : ''}`
        }),
      )
    }
    if (input === 'B') {
      runJob('批量构建 stale 资产', (onText) =>
        runAction(ctx, 'build', { positionals: [], flags: { stale: true } }, { onText }).then((r) => {
          if (r.ok && r.message) onText(r.message)
          return r.ok ? null : `${r.message ?? 'failed'}${r.logPath ? `\nlog: ${r.logPath}` : ''}`
        }),
      )
    }
    if (input === 'w' && row.status === 'dirty') {
      runJob(`回写 ${row.asset.name}`, (onText) =>
        runAction(ctx, 'writeback', { positionals: [row.asset.name], flags: {} }, { onText }).then((r) => {
          if (r.ok && r.message) onText(r.message)
          return r.ok ? null : `${r.message ?? 'failed'}${r.logPath ? `\nlog: ${r.logPath}` : ''}`
        }),
      )
    }
  })

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>infra-ai meta</Text>
      <Box marginTop={1}>
        {view === 'detail' && rows[selected] && (
          <AssetDetail row={rows[selected]} onExit={() => setView('assets')} />
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
              ? '再按一次 q 退出'
              : '上下 移动  Enter 详情  a 收编  b 构建  B 批量构建 stale  w 回写  s skills 对账  r 刷新  q 退出'}
          </Text>
        </Box>
      )}
    </Box>
  )
}
