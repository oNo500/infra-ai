import { useEffect, useMemo, useRef, useState } from 'react'
import { Box, Text, useInput } from 'ink'
import type { ActionStep, IuseContext } from '../core/init'
import { loadDownstreamLock } from '../core/manifest'
import { runUpdate } from '../core/update'
import { DiffView } from './diff-view'
import { MessageBlock } from './message-block'
import { ProgressView } from './progress-view'

type PlanState =
  | { kind: 'loading' }
  | { kind: 'plan'; steps: ActionStep[] }
  | { kind: 'plan-error'; message: string }
  | { kind: 'running'; steps: ActionStep[]; attempt: number }
  | { kind: 'run-error'; steps: ActionStep[]; message: string }

type Decision = 'overwrite' | 'ignore'

/** 每类步骤共享的一行文案；excluded 合成行不经过这里（单独渲染）。 */
function formatStep(step: ActionStep): string {
  const base = step.note === undefined ? `${step.op} ${step.target}` : `${step.op} ${step.target} (${step.note})`
  return step.op === 'skip-modified' ? `${base}  默认跳过` : base
}

function ruleFromTargetRelPath(targetRelPath: string): string {
  return targetRelPath.replace(/^\.claude\/rules\//u, '').replace(/\.md$/u, '')
}

interface Row {
  key: string
  rule: string | undefined
  label: string
  /** excluded 合成行才可勾选；modified 行与差异化补回行才可进 diff-view。 */
  toggleable: boolean
  checked: boolean
  diffable: boolean
}

function buildRows(steps: ActionStep[], excludedRules: string[], includeCandidates: ReadonlySet<string>): Row[] {
  const rows: Row[] = steps.map((step, i) => {
    const isReincludeStep = step.op === 'include' || step.op === 'skip-include'
    const rule = step.op === 'skip-modified' || isReincludeStep ? ruleFromTargetRelPath(step.target) : undefined
    return {
      key: `${step.op} ${step.target} ${i}`,
      rule,
      label: formatStep(step),
      toggleable: isReincludeStep,
      checked: isReincludeStep,
      diffable: step.op === 'skip-modified' || step.op === 'skip-include',
    }
  })

  // Excluded rules the caller hasn't marked as re-include candidates produce
  // no step from runUpdate (permanent gate, per Decision 4) -- synthesize
  // their row here so the view always shows every excluded rule as unchecked.
  for (const rule of excludedRules) {
    if (includeCandidates.has(rule)) continue
    rows.push({
      key: `excluded ${rule}`,
      rule,
      label: `${rule} excluded`,
      toggleable: true,
      checked: false,
      diffable: false,
    })
  }

  return rows
}

export function UpdatePlanView({
  ctx,
  target,
  source,
  initialAdd,
  initialRemove,
  onDone,
  onBack,
  onQuit,
}: {
  ctx: IuseContext
  target: string
  source: string | undefined
  /** Browse's `a` action seeds a single rule here -- an explicit add, distinct
   *  from the re-include candidates toggled interactively below (both flow
   *  through runUpdate's `add`, which differentiates by excluded-state). */
  initialAdd?: string[]
  /** Browse's `x` action seeds a single rule here -- a one-shot remove, not
   *  interactively toggleable in this view (no undo affordance exists for it). */
  initialRemove?: string[]
  onDone: () => void
  onBack: () => void
  onQuit: () => void
}) {
  const [force, setForce] = useState(false)
  const [includeCandidates, setIncludeCandidates] = useState<ReadonlySet<string>>(new Set(initialAdd ?? []))
  const [remove] = useState<readonly string[]>(initialRemove ?? [])
  const [decisions, setDecisions] = useState<ReadonlyMap<string, Decision>>(new Map())
  const [cursor, setCursor] = useState(0)
  const [diffRule, setDiffRule] = useState<string | undefined>(undefined)
  const [state, setState] = useState<PlanState>({ kind: 'loading' })
  // useInput's handler closes over render-time state; two keystrokes landing in the
  // same tick (e.g. scripted test input, or a fast typist) would otherwise read a
  // stale cursor. A ref mirrors the latest value synchronously across such calls.
  const cursorRef = useRef(cursor)
  cursorRef.current = cursor

  const excludedRules = useMemo(() => loadDownstreamLock(target)?.excluded ?? [], [target])

  useEffect(() => {
    let cancelled = false
    setState({ kind: 'loading' })
    runUpdate(ctx, { source, target, force, add: [...includeCandidates], remove: [...remove], dryRun: true }).then((result) => {
      if (cancelled) return
      if (result.ok && result.steps !== undefined) {
        setState({ kind: 'plan', steps: result.steps })
      } else {
        setState({ kind: 'plan-error', message: result.message })
      }
    })
    return () => {
      cancelled = true
    }
    // ctx/target/source 是挂载时的固化快照；force/includeCandidates 变化触发重取 dry-run 计划。
  }, [force, includeCandidates])

  const rows = state.kind === 'plan' ? buildRows(state.steps, excludedRules, includeCandidates) : []

  useInput((input, key) => {
    // Mid-execution, a stray 'q' must not tear down the run: writes/instantiation
    // may already be in flight, and quitting the whole app here would leave the
    // lock and target in an unobserved partial state instead of surfacing the
    // done/fail transition ProgressView is already driving toward.
    if (input === 'q' && state.kind !== 'running') {
      onQuit()
      return
    }
    if (diffRule !== undefined) return // DiffView owns input while open

    if (state.kind === 'plan' || state.kind === 'plan-error') {
      if (input === 'f') {
        setForce((f) => !f)
        return
      }
      if (key.escape) {
        onBack()
        return
      }
    }

    if (state.kind === 'plan') {
      if (key.upArrow) {
        setCursor((c) => {
          const next = Math.max(0, c - 1)
          cursorRef.current = next
          return next
        })
        return
      }
      if (key.downArrow) {
        setCursor((c) => {
          const next = Math.min(rows.length - 1, c + 1)
          cursorRef.current = next
          return next
        })
        return
      }
      if (input === ' ') {
        const row = rows[cursorRef.current]
        if (row?.toggleable !== true || row.rule === undefined) return
        const rule = row.rule
        setIncludeCandidates((prev) => {
          const next = new Set(prev)
          if (next.has(rule)) next.delete(rule)
          else next.add(rule)
          return next
        })
        return
      }
      if (key.return) {
        const row = rows[cursorRef.current]
        if (row?.diffable === true && row.rule !== undefined) {
          setDiffRule(row.rule)
        }
        return
      }
      if (input === 'e') {
        setState((prev) => ({ kind: 'running', steps: prev.kind === 'plan' ? prev.steps : [], attempt: 0 }))
      }
      return
    }

    if (state.kind === 'run-error') {
      if (input === 'r') {
        setState((prev) => ({ kind: 'running', steps: prev.kind === 'run-error' ? prev.steps : [], attempt: 0 }))
      } else if (key.escape) {
        onBack()
      }
    }
  })

  if (diffRule !== undefined) {
    return (
      <DiffView
        ctx={ctx}
        target={target}
        source={source}
        rule={diffRule}
        onAdjudicate={(decision) => {
          setDecisions((prev) => {
            const next = new Map(prev)
            next.set(diffRule, decision)
            return next
          })
          setDiffRule(undefined)
        }}
        onBack={() => setDiffRule(undefined)}
      />
    )
  }

  if (state.kind === 'loading') {
    return <Text dimColor>加载 update 计划中...</Text>
  }

  if (state.kind === 'running') {
    const overwrite = [...decisions.entries()].filter(([, decision]) => decision === 'overwrite').map(([rule]) => rule)
    const add = [...includeCandidates]
    return (
      <ProgressView
        key={state.attempt}
        steps={state.steps}
        run={(onProgress) => runUpdate(ctx, { source, target, force, add, remove: [...remove], overwrite, onProgress })}
        onDone={() => onDone()}
        onFail={(message) => setState((prev) => ({ kind: 'run-error', steps: prev.kind === 'running' ? prev.steps : [], message }))}
      />
    )
  }

  if (state.kind === 'run-error') {
    return <MessageBlock title="出错了" message={state.message} tone="error" hint="r 重试  esc 返回" />
  }

  if (state.kind === 'plan-error') {
    return (
      <Box flexDirection="column">
        <MessageBlock title="出错了" message={state.message} tone="error" hint="esc 返回" />
        <Box marginTop={1}>
          <Text dimColor>f 切换 force（当前 {force ? '开' : '关'}）</Text>
        </Box>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      <Text bold>update 计划预览（dry-run）</Text>
      {force && (
        <Box marginTop={1}>
          <Text color="yellow" bold>
            force 已开启：modified/missing 项将被覆盖
          </Text>
        </Box>
      )}
      <Box flexDirection="column" marginTop={1}>
        {rows.map((row, i) => {
          // A decision was only ever recorded through DiffView, reachable
          // exclusively from a diffable row. If the plan re-fetch (triggered
          // by toggling force/includeCandidates) later reshapes this rule's
          // row into something else -- e.g. it resolves to a clean 'include'
          // once local content stops differing, or reverts to the synthesized
          // 'excluded' row -- the stale decision no longer describes a real
          // choice on the row and must not render.
          const decision = row.rule !== undefined && row.diffable ? decisions.get(row.rule) : undefined
          const suffix = decision === 'overwrite' ? '  [覆盖]' : decision === 'ignore' ? '  [忽略]' : ''
          const checkbox = row.toggleable ? (row.checked ? '[x] ' : '[ ] ') : ''
          return (
            <Text key={row.key} inverse={i === cursor}>
              {checkbox}
              {row.label}
              {suffix}
            </Text>
          )
        })}
        {rows.length === 0 && <Text dimColor>无步骤</Text>}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>↑↓ 移动  space 勾选补回  Enter 查看差异  o/i 在差异视图裁决  e 执行  f 切换 force  esc 返回 Status  q 退出</Text>
      </Box>
    </Box>
  )
}
