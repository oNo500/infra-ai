import { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { TextInput } from '@inkjs/ui'
import type { ActionContext } from '../core/actions'
import { getAction } from '../core/actions'
import { loadTargets } from '../core/registry'
import type { Target } from '../core/registry'

type Mode = 'list' | 'add' | 'subs'

export function TargetsView({
  repoRoot,
  ctx,
  rules,
  onExit,
}: {
  repoRoot: string
  ctx: ActionContext
  rules: string[]
  onExit: () => void
}) {
  const [targets, setTargets] = useState<Target[]>(() => loadTargets(repoRoot))
  const [selected, setSelected] = useState(0)
  const [subSelected, setSubSelected] = useState(0)
  const [mode, setMode] = useState<Mode>('list')
  const [notice, setNotice] = useState<string | null>(null)

  const refresh = () => setTargets(loadTargets(repoRoot))

  useInput((input, key) => {
    if (mode === 'add') return
    if (mode === 'subs') {
      const target = targets[selected]
      if (!target) return
      if (key.escape) setMode('list')
      if (key.upArrow) setSubSelected((s) => Math.max(0, s - 1))
      if (key.downArrow) setSubSelected((s) => Math.min(rules.length - 1, s + 1))
      if (input === ' ') {
        const rule = rules[subSelected]
        if (!rule) return
        const actionId = target.subscriptions.includes(rule)
          ? 'targets:unsubscribe'
          : 'targets:subscribe'
        void getAction(actionId)
          .execute(ctx, { positionals: [target.path, rule], flags: {} })
          .then((r) => {
            if (!r.ok) setNotice(r.message ?? 'failed')
            refresh()
          })
      }
      return
    }
    if (key.escape || input === 't') onExit()
    if (key.upArrow) setSelected((s) => Math.max(0, s - 1))
    if (key.downArrow) setSelected((s) => Math.min(targets.length - 1, s + 1))
    if (input === 'n') setMode('add')
    if (input === 'x' && targets[selected]) {
      const target = targets[selected]
      void getAction('targets:remove')
        .execute(ctx, { positionals: [target.path], flags: {} })
        .then((r) => {
          if (!r.ok) setNotice(r.message ?? 'failed')
          refresh()
        })
      setSelected((s) => Math.max(0, s - 1))
    }
    if (key.return && targets[selected]) {
      setSubSelected(0)
      setMode('subs')
    }
  })

  if (mode === 'add') {
    return (
      <Box flexDirection="column">
        <Text bold>新增 target（下游项目绝对路径，Enter 确认）</Text>
        <TextInput
          onSubmit={(value) => {
            const trimmed = value.trim()
            if (trimmed !== '') {
              void getAction('targets:add')
                .execute(ctx, { positionals: [trimmed], flags: {} })
                .then((r) => {
                  if (!r.ok) setNotice(r.message ?? 'failed')
                  refresh()
                })
            }
            setMode('list')
          }}
        />
      </Box>
    )
  }

  if (mode === 'subs') {
    const target = targets[selected]
    return (
      <Box flexDirection="column">
        <Text bold>{target?.path} 的订阅（space 勾选，Esc 返回）</Text>
        {rules.map((rule, i) => (
          <Text key={rule} inverse={i === subSelected}>
            [{target?.subscriptions.includes(rule) ? 'x' : ' '}] {rule}
          </Text>
        ))}
        {rules.length === 0 && <Text dimColor>没有已构建的 rule 产物</Text>}
        {notice && (
          <Box marginTop={1}>
            <Text>{notice}</Text>
          </Box>
        )}
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      <Text bold>targets</Text>
      {targets.map((t, i) => (
        <Text key={t.path} inverse={i === selected}>
          {t.path}  [{t.subscriptions.join(', ')}]
        </Text>
      ))}
      {targets.length === 0 && <Text dimColor>暂无 target</Text>}
      {notice && (
        <Box marginTop={1}>
          <Text>{notice}</Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text dimColor>n add  x delete  Enter subscriptions  t/Esc back</Text>
      </Box>
    </Box>
  )
}
