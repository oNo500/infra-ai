import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { render } from 'ink-testing-library'
import type { Catalog } from '../src/core/contract'
import { App } from '../src/tui/app'
import type { TuiDeps } from '../src/tui/app'
import { runInit } from '../src/core/init'
import type { IuseContext } from '../src/core/init'
import { loadDownstreamLock } from '../src/core/manifest'

function fixtureSource(): string {
  const dir = mkdtempSync(join(tmpdir(), 'iuse-tui-status-src-'))
  mkdirSync(join(dir, 'rules'), { recursive: true })
  mkdirSync(join(dir, 'templates'), { recursive: true })
  writeFileSync(join(dir, 'rules', 'constitution.md'), '# Constitution\n')
  writeFileSync(join(dir, 'rules', 'edited.md'), '# Edited\n')
  writeFileSync(join(dir, 'rules', 'gone.md'), '# Gone\n')
  writeFileSync(
    join(dir, 'profiles.json'),
    JSON.stringify({ demo: { description: 'Demo profile', rules: ['constitution', 'edited', 'gone'] } }),
  )
  writeFileSync(join(dir, 'templates', 'settings.json'), JSON.stringify({ model: 'sonnet' }))
  writeFileSync(join(dir, 'templates', 'architecture.md'), '# [PROJECT_NAME] - Architecture\n\nbody\n')
  writeFileSync(join(dir, 'templates', 'claude-md.md'), '# [PROJECT_NAME]\n\nbody\n')
  writeFileSync(join(dir, 'templates', 'template-instantiate.md'), '# contract\n')

  // catalog.json is browse's data source (entered via 'b' from status) --
  // handwritten to match the base profile rules present at fixture creation.
  const catalog: Catalog = {
    generatedAt: '2026-07-18T00:00:00Z',
    tags: { concern: { exclusive: false, values: { core: 'x' } } },
    rules: {
      constitution: { description: 'x', tags: ['core'], requires: [], scope: 'global', path: 'rules/constitution.md', profiles: ['demo'] },
      edited: { description: 'x', tags: ['core'], requires: [], scope: 'global', path: 'rules/edited.md', profiles: ['demo'] },
      gone: { description: 'x', tags: ['core'], requires: [], scope: 'global', path: 'rules/gone.md', profiles: ['demo'] },
    },
  }
  writeFileSync(join(dir, 'catalog.json'), JSON.stringify(catalog, null, 2))

  return dir
}

function fakeClaudeInstant(): IuseContext['claude'] {
  return async (opts) => {
    const match = /(?:Write|Edit)\((.+)\)/u.exec(opts.allowedTools)
    const rel = match?.[1]
    if (rel === undefined) throw new Error('no target file in allowedTools')
    const targetFile = join(opts.repoRoot, rel)
    writeFileSync(targetFile, targetFile.endsWith('architecture.md') ? '# demo - Architecture\n\nbody\n' : '# demo\n\nbody\n')
    return { code: 0, timedOut: false, stderr: '' }
  }
}

function fakeCtx(overrides: Partial<IuseContext> = {}): IuseContext {
  return {
    download: async () => ({}),
    run: async () => ({ code: 0, stdout: 'head1\n', stderr: '' }),
    claude: fakeClaudeInstant(),
    now: () => '2026-07-18T00:00:00Z',
    env: {},
    home: '/nope',
    cacheDir: mkdtempSync(join(tmpdir(), 'iuse-tui-status-cache-')),
    ...overrides,
  }
}

/**
 * A fake `run` that blocks on a manually-releasable gate starting from its
 * Nth invocation -- mirrors fakeClaudeGatedOnce in tui-init-flow.test.tsx, but
 * for runUpdate's real (non-dry-run) execution path, which re-resolves the
 * source via ctx.run('git', ...) and never calls ctx.claude. `gateFromCall`
 * skips the earlier calls the TUI's own bootstrap/TopBar-backfill machinery
 * makes (each of those also goes through ctx.run to resolve the source), so
 * the gate lands on the specific resolveSource call triggered by pressing
 * 'e' to execute, freezing the 'running' state open long enough to press a
 * key mid-execution.
 */
function fakeRunGatedFromCall(gateFromCall: number): { run: IuseContext['run']; release: () => void } {
  let releaseGate: (() => void) | undefined
  const gate = new Promise<void>((resolve) => {
    releaseGate = resolve
  })
  let calls = 0
  const run: IuseContext['run'] = async () => {
    calls += 1
    if (calls >= gateFromCall) await gate
    return { code: 0, stdout: 'head1\n', stderr: '' }
  }
  if (releaseGate === undefined) throw new Error('gate executor did not run synchronously')
  return { run, release: releaseGate }
}

/** 超时诊断：waitFor 失败时带出最后一帧，CI 上无法交互式排障全靠它 */
let lastFrameForDiag: (() => string | undefined) | undefined

function bootApp(deps: TuiDeps): ReturnType<typeof render> {
  const instance = render(<App deps={deps} />)
  lastFrameForDiag = instance.lastFrame
  return instance
}

/**
 * 新视图首帧 commit 后，其 useInput 订阅要等 passive effect flush 才挂上；
 * 见帧就写键会把键写进无监听者的 fake stdin（真实终端有内核缓冲，无此问题）。
 * 写键前让出 50ms，跨过这个空窗。
 */
async function press(stdin: { write: (data: string) => void }, key: string): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 50))
  stdin.write(key)
}

/** Local polling helper -- no new dependency, per task brief. */
async function waitFor(predicate: () => boolean, timeoutMs = 15000): Promise<void> {
  const start = Date.now()
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`waitFor: timed out; last frame:\n${lastFrameForDiag?.() ?? '<no frame>'}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

/**
 * The TUI now always lands on the home menu first (Task: home menu as the
 * interactive entry) -- an initialized target no longer routes straight to
 * status. Home's cursor defaults to '状态对账' (the first item) on an
 * initialized target, so a bare enter reaches the same status-rows state the
 * old direct-boot tests asserted on.
 */
async function enterStatusFromHome(stdin: { write: (data: string) => void }, lastFrame: () => string | undefined): Promise<void> {
  await waitFor(() => (lastFrame() ?? '').includes('状态对账'))
  await press(stdin, '\r') // enter: status (default cursor)
  await waitFor(() => (lastFrame() ?? '').includes('constitution'))
}

/**
 * Builds an initialized target with all five status states present:
 * - constitution: untouched -> synced
 * - edited: locally modified -> modified
 * - gone: locally deleted -> missing
 * - extra (added to source profile after init, not yet installed) -> available
 */
async function initTargetWithAllStates(source: string): Promise<string> {
  const target = mkdtempSync(join(tmpdir(), 'iuse-tui-status-tgt-'))
  const result = await runInit(fakeCtx(), { source, profile: 'demo', target, force: false })
  if (!result.ok) throw new Error(`fixture init failed: ${result.message}`)

  writeFileSync(join(target, '.claude/rules/edited.md'), '# Edited\n\nlocally edited\n')
  rmSync(join(target, '.claude/rules/gone.md'))

  writeFileSync(join(source, 'rules', 'extra.md'), '# Extra\n')
  writeFileSync(
    join(source, 'profiles.json'),
    JSON.stringify({ demo: { description: 'Demo profile', rules: ['constitution', 'edited', 'gone', 'extra'] } }),
  )
  const catalog = JSON.parse(readFileSync(join(source, 'catalog.json'), 'utf8')) as Catalog
  catalog.rules.extra = { description: 'x', tags: ['core'], requires: [], scope: 'global', path: 'rules/extra.md', profiles: ['demo'] }
  writeFileSync(join(source, 'catalog.json'), JSON.stringify(catalog, null, 2))

  return target
}

/**
 * Builds an initialized target where 'gone' is recorded as excluded (permanent
 * gate, per Decision 4) instead of being a plain drift state -- for exercising
 * the update-plan-view's re-include/diff/adjudicate flow.
 */
async function initTargetWithExcludedRule(source: string): Promise<string> {
  const target = mkdtempSync(join(tmpdir(), 'iuse-tui-status-tgt-'))
  const result = await runInit(fakeCtx(), { source, profile: 'demo', target, force: false, exclude: ['gone'] })
  if (!result.ok) throw new Error(`fixture init failed: ${result.message}`)

  writeFileSync(join(target, '.claude/rules/edited.md'), '# Edited\n\nlocally edited\n')

  return target
}

describe('TUI status flow', () => {
  test('initialized target lands on status rows with all drift states rendered, excluded rows dimmed, and the TopBar source locator backfilled', async () => {
    const source = fixtureSource()
    const target = await initTargetWithAllStates(source)
    const deps: TuiDeps = { ctx: fakeCtx(), target, source }

    const { lastFrame, stdin } = bootApp(deps)

    await enterStatusFromHome(stdin, lastFrame)
    const frame = lastFrame() ?? ''

    const lineFor = (rule: string) => frame.split('\n').find((l) => l.includes(rule)) ?? ''
    expect(lineFor('constitution')).toContain('synced')
    expect(lineFor('edited')).toContain('modified')
    expect(lineFor('gone')).toContain('missing')
    expect(lineFor('extra')).toContain('available')

    // The status path never resolves a source itself (unlike profile-pick),
    // so the TopBar backfills it during bootstrap via the same resolveSource
    // wiring the picker path uses -- locator@version.id, from the fixture's
    // `run` stub (git rev-parse HEAD -> 'head1', porcelain non-empty -> dirty).
    // TopBar 在窄终端会于 source 与 locator 之间折行，压缩全部空白后再比对
    await waitFor(() => (lastFrame() ?? '').replace(/\s+/gu, '').includes(`source${source}@head1-dirty`))
  })

  test('excluded rule renders as a dimmed "<rule> excluded" row in status', async () => {
    const source = fixtureSource()
    const target = await initTargetWithExcludedRule(source)
    const deps: TuiDeps = { ctx: fakeCtx(), target, source }

    const { lastFrame, stdin } = bootApp(deps)

    await enterStatusFromHome(stdin, lastFrame)
    const frame = lastFrame() ?? ''
    const goneLine = frame.split('\n').find((l) => l.includes('gone')) ?? ''
    expect(goneLine).toContain('gone')
    expect(goneLine).toContain('excluded')
  })

  test('u shows update plan with 默认跳过 annotation on the modified row', async () => {
    const source = fixtureSource()
    const target = await initTargetWithAllStates(source)
    const deps: TuiDeps = { ctx: fakeCtx(), target, source }

    const { lastFrame, stdin } = bootApp(deps)
    await enterStatusFromHome(stdin, lastFrame)

    await press(stdin, 'u')
    await waitFor(() => (lastFrame() ?? '').includes('update 计划预览'))

    // ink wraps a long row across terminal width, so the trailing annotation
    // can land on its own printed line -- assert it immediately follows the
    // skip-modified row for edited.md rather than requiring one physical line.
    const lines = (lastFrame() ?? '').split('\n')
    const modifiedIdx = lines.findIndex((l) => l.includes('edited.md') && l.includes('skip-modified'))
    expect(modifiedIdx).toBeGreaterThanOrEqual(0)
    expect(lines.slice(modifiedIdx, modifiedIdx + 2).join(' ')).toContain('默认跳过')
    // The other skipped row (gone.md) does not carry the annotation.
    const missingIdx = lines.findIndex((l) => l.includes('gone.md') && l.includes('skip-missing'))
    expect(lines.slice(missingIdx, missingIdx + 2).join(' ')).not.toContain('默认跳过')
  })

  test('f re-fetches the plan and shows a force indicator', async () => {
    const source = fixtureSource()
    const target = await initTargetWithAllStates(source)
    const deps: TuiDeps = { ctx: fakeCtx(), target, source }

    const { lastFrame, stdin } = bootApp(deps)
    await enterStatusFromHome(stdin, lastFrame)

    await press(stdin, 'u')
    await waitFor(() => (lastFrame() ?? '').includes('update 计划预览'))
    expect(lastFrame()).not.toContain('force 已开启')

    await press(stdin, 'f')
    // force 指示是同步置位的，重取的计划行随后才到；两者都到齐再断言
    await waitFor(() => {
      const fr = lastFrame() ?? ''
      return fr.includes('force 已开启') && (fr.split('\n').find((l) => l.includes('edited.md')) ?? '').includes('apply')
    })

    const frame = lastFrame() ?? ''
    const editedLine = frame.split('\n').find((l) => l.includes('edited.md'))
    expect(editedLine).toContain('apply')
    expect(editedLine).not.toContain('默认跳过')
  })

  test('e runs the update and returns to a refreshed status view; r on status re-fetches instead of showing stale rows; q quits without a crash', async () => {
    const source = fixtureSource()
    const target = await initTargetWithAllStates(source)
    const deps: TuiDeps = { ctx: fakeCtx(), target, source }

    const { lastFrame, stdin } = bootApp(deps)
    await enterStatusFromHome(stdin, lastFrame)

    await press(stdin, 'u')
    await waitFor(() => (lastFrame() ?? '').includes('update 计划预览'))

    await press(stdin, 'e') // execute (force off -> edited stays modified, others resolve)
    await waitFor(() => (lastFrame() ?? '').includes('状态'))
    await waitFor(() => (lastFrame() ?? '').includes('extra'))

    const frame = lastFrame() ?? ''
    const lineFor = (rule: string) => frame.split('\n').find((l) => l.includes(rule)) ?? ''
    // 'extra' is only profile-new (available), never auto-pulled by update --
    // it stays 'available' through the run; explicit --add is Task 5's surface.
    expect(lineFor('extra')).toContain('available')
    expect(lineFor('edited')).toContain('modified') // still skipped, force was off

    // Fix the "modified" drift out from under the TUI, then refresh and
    // confirm the view re-fetches instead of showing stale rows.
    writeFileSync(join(target, '.claude/rules/edited.md'), '# Edited\n')
    await press(stdin, 'r')
    await waitFor(() => {
      const line = (lastFrame() ?? '').split('\n').find((l) => l.includes('edited'))
      return line !== undefined && line.includes('synced')
    })

    // ink's useApp().exit() flips isDone/unmounts internally; assert no crash
    // and the frame is unchanged (no further view transition happened).
    await press(stdin, 'q')
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(lastFrame()).toContain('constitution')
  })

  test('q is ignored while an update execution is running -- it must not tear down a run in flight', async () => {
    const source = fixtureSource()
    const target = await initTargetWithAllStates(source)
    // Calls 1-4: bootstrap (TopBar source backfill + StatusView's own status
    // fetch, each resolving the source via 2 `run` invocations). Calls 5-6:
    // the update-plan dry-run fetch triggered by 'u'. Call 7 is the first
    // `run` invocation of the real (non-dry-run) execution triggered by 'e' --
    // gating from there stalls exactly that resolveSource call.
    const { run, release } = fakeRunGatedFromCall(7)
    const deps: TuiDeps = { ctx: fakeCtx({ run }), target, source }

    const { lastFrame, stdin } = bootApp(deps)
    await enterStatusFromHome(stdin, lastFrame)

    await press(stdin, 'u')
    await waitFor(() => (lastFrame() ?? '').includes('update 计划预览'))

    await press(stdin, 'e') // execute -- runUpdate re-resolves the source, stalling on the gated run
    await waitFor(() => (lastFrame() ?? '').includes('执行中'))

    await press(stdin, 'q') // must be a no-op: the run is still in flight
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(lastFrame()).toContain('执行中')

    release()
    await waitFor(() => (lastFrame() ?? '').includes('状态'))
  })

  test('re-include candidate with differing local content opens diff view, o marks 覆盖, e overwrites the file', async () => {
    const source = fixtureSource()
    const target = await initTargetWithExcludedRule(source)
    // 'gone' is excluded and has no local copy; write one that differs from
    // source so the re-include candidacy lands on the differing-content path.
    writeFileSync(join(target, '.claude/rules/gone.md'), '# Gone\n\nlocally kept different content\n')
    const deps: TuiDeps = { ctx: fakeCtx(), target, source }

    const { lastFrame, stdin } = bootApp(deps)
    await enterStatusFromHome(stdin, lastFrame)

    // Every keystroke below gets a short settle delay before the next one fires:
    // useInput's handler closes over render-time `rows`/state, so back-to-back
    // writes in the same tick can race the effect-driven plan refetch and drop
    // a step (this mirrors real typed input, which never arrives same-tick anyway).
    const settle = () => new Promise((resolve) => setTimeout(resolve, 30))

    await press(stdin, 'u')
    await settle()
    await waitFor(() => (lastFrame() ?? '').includes('update 计划预览'))
    await waitFor(() => (lastFrame() ?? '').split('\n').some((l) => l.includes('gone') && l.includes('excluded')))

    // Rows: [0] constitution (synced), [1] edited (skip-modified), [2] gone (excluded).
    // Two down-arrows land the cursor on gone; space marks it a re-include candidate,
    // which re-fetches the plan and turns row 2 into a 'skip-include' step (still index 2,
    // since it lands in the same slot the synthesized excluded row occupied).
    await press(stdin, '[B')
    await settle()
    await press(stdin, '[B')
    await settle()
    await press(stdin, ' ') // space: mark gone as re-include candidate
    await waitFor(() => (lastFrame() ?? '').split('\n').some((l) => l.includes('gone') && l.includes('skip-include')))
    await settle()

    await press(stdin, '\r') // enter: gone row (still selected) is now diffable -> open diff view
    await waitFor(() => (lastFrame() ?? '').includes('gone 差异'))
    await settle()

    const diffFrame = lastFrame() ?? ''
    expect(diffFrame).toContain('+')
    expect(diffFrame).toContain('-')

    await press(stdin, 'o') // adjudicate: overwrite
    // ink wraps the long skip-include row across two printed lines, so the
    // trailing [覆盖] suffix can land on its own line -- scan adjacent-line
    // pairs rather than requiring 'gone' and the suffix on one physical line.
    await waitFor(() => {
      const lines = (lastFrame() ?? '').split('\n')
      return lines.some((l, i) => l.includes('gone') && lines.slice(i, i + 2).join(' ').includes('[覆盖]'))
    })
    await settle()

    await press(stdin, 'e') // execute
    await waitFor(() => (lastFrame() ?? '').includes('状态'))

    const lock = loadDownstreamLock(target)
    expect(lock?.excluded ?? []).not.toContain('gone')
    expect(readFileSync(join(target, '.claude/rules/gone.md'), 'utf8')).toBe('# Gone\n')
  })

  test('un-checking an adjudicated re-include candidate drops the stale [覆盖] suffix instead of carrying it onto the reverted excluded row', async () => {
    const source = fixtureSource()
    const target = await initTargetWithExcludedRule(source)
    writeFileSync(join(target, '.claude/rules/gone.md'), '# Gone\n\nlocally kept different content\n')
    const deps: TuiDeps = { ctx: fakeCtx(), target, source }

    const { lastFrame, stdin } = bootApp(deps)
    await enterStatusFromHome(stdin, lastFrame)

    const settle = () => new Promise((resolve) => setTimeout(resolve, 30))

    await press(stdin, 'u')
    await settle()
    await waitFor(() => (lastFrame() ?? '').includes('update 计划预览'))
    await waitFor(() => (lastFrame() ?? '').split('\n').some((l) => l.includes('gone') && l.includes('excluded')))

    await press(stdin, '[B')
    await settle()
    await press(stdin, '[B')
    await settle()
    await press(stdin, ' ') // space: mark gone as re-include candidate
    await waitFor(() => (lastFrame() ?? '').split('\n').some((l) => l.includes('gone') && l.includes('skip-include')))
    await settle()

    await press(stdin, '\r') // enter: open diff view for gone
    await waitFor(() => (lastFrame() ?? '').includes('gone 差异'))
    await settle()

    await press(stdin, 'o') // adjudicate: overwrite -- records a decision for 'gone'
    await waitFor(() => {
      const lines = (lastFrame() ?? '').split('\n')
      return lines.some((l, i) => l.includes('gone') && lines.slice(i, i + 2).join(' ').includes('[覆盖]'))
    })
    await settle()

    // Cursor is still on the gone row (index 2); un-check it to withdraw the
    // re-include candidacy. The plan re-fetch reverts row 2 to the
    // synthesized "excluded, not a candidate" row -- the earlier decision no
    // longer describes a live choice on this shape-changed row, so [覆盖]
    // must not carry over onto it.
    await press(stdin, ' ')
    await waitFor(() => (lastFrame() ?? '').split('\n').some((l) => l.includes('gone excluded')))
    await settle()

    const revertedFrame = lastFrame() ?? ''
    const lines = revertedFrame.split('\n')
    const goneIdx = lines.findIndex((l) => l.includes('gone excluded'))
    expect(goneIdx).toBeGreaterThanOrEqual(0)
    expect(lines.slice(goneIdx, goneIdx + 2).join(' ')).not.toContain('[覆盖]')
  })

  test('adjudicating a re-include candidate as 忽略 keeps the local file and the row shows [忽略]', async () => {
    const source = fixtureSource()
    const target = await initTargetWithExcludedRule(source)
    writeFileSync(join(target, '.claude/rules/gone.md'), '# Gone\n\nlocally kept different content\n')
    const deps: TuiDeps = { ctx: fakeCtx(), target, source }

    const { lastFrame, stdin } = bootApp(deps)
    await enterStatusFromHome(stdin, lastFrame)

    const settle = () => new Promise((resolve) => setTimeout(resolve, 30))

    await press(stdin, 'u')
    await settle()
    await waitFor(() => (lastFrame() ?? '').includes('update 计划预览'))
    await waitFor(() => (lastFrame() ?? '').split('\n').some((l) => l.includes('gone') && l.includes('excluded')))

    await press(stdin, '[B')
    await settle()
    await press(stdin, '[B')
    await settle()
    await press(stdin, ' ') // space: mark gone as re-include candidate
    await waitFor(() => (lastFrame() ?? '').split('\n').some((l) => l.includes('gone') && l.includes('skip-include')))
    await settle()

    await press(stdin, '\r') // enter: open diff view for gone
    await waitFor(() => (lastFrame() ?? '').includes('gone 差异'))
    await settle()

    await press(stdin, 'i') // adjudicate: ignore (skip this run, keep local)
    // Same physical-line-wrap caveat as the overwrite path above.
    await waitFor(() => {
      const lines = (lastFrame() ?? '').split('\n')
      return lines.some((l, i) => l.includes('gone') && lines.slice(i, i + 2).join(' ').includes('[忽略]'))
    })
    await settle()

    await press(stdin, 'e') // execute
    await waitFor(() => (lastFrame() ?? '').includes('状态'))

    // Ignored: local file untouched, rule stays excluded (not re-included this run).
    expect(readFileSync(join(target, '.claude/rules/gone.md'), 'utf8')).toBe('# Gone\n\nlocally kept different content\n')
    const lock = loadDownstreamLock(target)
    expect(lock?.excluded ?? []).toContain('gone')
  })

  test('diff view truncates patches beyond 200 lines and points at the CLI for the full diff', async () => {
    const source = fixtureSource()
    const target = await initTargetWithExcludedRule(source)
    // Local content differs from source by 250+ lines so the unified patch exceeds
    // diff-view's MAX_LINES truncation threshold.
    const manyLines = Array.from({ length: 250 }, (_, i) => `local line ${i}`).join('\n')
    writeFileSync(join(target, '.claude/rules/gone.md'), `${manyLines}\n`)
    const deps: TuiDeps = { ctx: fakeCtx(), target, source }

    const { lastFrame, stdin } = bootApp(deps)
    await enterStatusFromHome(stdin, lastFrame)

    const settle = () => new Promise((resolve) => setTimeout(resolve, 30))

    await press(stdin, 'u')
    await settle()
    await waitFor(() => (lastFrame() ?? '').includes('update 计划预览'))
    await waitFor(() => (lastFrame() ?? '').split('\n').some((l) => l.includes('gone') && l.includes('excluded')))

    await press(stdin, '[B')
    await settle()
    await press(stdin, '[B')
    await settle()
    await press(stdin, ' ') // space: mark gone as re-include candidate
    await waitFor(() => (lastFrame() ?? '').split('\n').some((l) => l.includes('gone') && l.includes('skip-include')))
    await settle()

    await press(stdin, '\r') // enter: open diff view for gone
    await waitFor(() => (lastFrame() ?? '').includes('gone 差异'))

    await waitFor(() => (lastFrame() ?? '').includes('完整差异'))
    const diffFrame = lastFrame() ?? ''
    expect(diffFrame).toContain('已截断')
    expect(diffFrame).toContain('iuse diff --rule gone')
  })
})
