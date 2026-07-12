import { describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getAction, runAction, type ActionContext, type StatusRowData } from '../src/core/actions'
import { sha256 } from '../src/core/io'

export function fixtureRepo(): string {
  const root = mkdtempSync(join(tmpdir(), 'meta-cli-'))
  writeFileSync(join(root, 'skills.json'), '[]\n')
  mkdirSync(join(root, 'meta/rules'), { recursive: true })
  writeFileSync(
    join(root, 'meta/rules/foo.md'),
    '---\nname: foo\ntarget: rule\nstatus: ready\nscope: global\n---\nbody\n',
  )
  return root
}

export function testContext(root: string, overrides: Partial<ActionContext> = {}): ActionContext {
  return {
    repoRoot: root,
    run: async () => ({ code: 0, stdout: '', stderr: '' }),
    now: () => '2026-07-11T00:00:00.000Z',
    claude: async () => ({ code: 0, timedOut: false, stderr: '' }),
    download: async () => ({}),
    fetchJson: async () => ({ files: [] }),
    ...overrides,
  }
}

export function syncLock(root: string): void {
  const meta = '---\nname: foo\ntarget: rule\nstatus: ready\nscope: global\n---\nbody\n'
  const artifact = '# foo\n'
  mkdirSync(join(root, 'rules/global'), { recursive: true })
  writeFileSync(join(root, 'rules/global/foo.md'), artifact)
  writeFileSync(
    join(root, 'artifacts.lock.json'),
    `${JSON.stringify({ 'rule:foo': { metaHash: sha256(meta), artifactHash: sha256(artifact), builtAt: '2026-07-11T00:00:00.000Z' } })}\n`,
  )
}

describe('status action', () => {
  test('unbuilt asset yields exitCode 1 with row data', async () => {
    const root = fixtureRepo()
    try {
      const result = await getAction('status').execute(testContext(root), { positionals: [], flags: {} })
      expect(result.ok).toBe(true)
      expect(result.exitCode).toBe(1)
      const rows = result.data as StatusRowData[]
      expect(rows[0]?.name).toBe('foo')
      expect(rows[0]?.status).toBe('unbuilt')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  test('untracked asset (artifact present, no lock) yields exitCode 1', async () => {
    const root = fixtureRepo()
    try {
      mkdirSync(join(root, 'rules/global'), { recursive: true })
      writeFileSync(join(root, 'rules/global/foo.md'), '# foo\n')
      const result = await getAction('status').execute(testContext(root), { positionals: [], flags: {} })
      expect(result.exitCode).toBe(1)
      const rows = result.data as StatusRowData[]
      expect(rows[0]?.status).toBe('untracked')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  test('all synced yields exitCode 0; named lookup filters; unknown name fails', async () => {
    const root = fixtureRepo()
    try {
      syncLock(root)
      const all = await getAction('status').execute(testContext(root), { positionals: [], flags: {} })
      expect(all.exitCode).toBe(0)
      const one = await getAction('status').execute(testContext(root), { positionals: ['foo'], flags: {} })
      expect((one.data as StatusRowData[]).length).toBe(1)
      const missing = await getAction('status').execute(testContext(root), { positionals: ['nope'], flags: {} })
      expect(missing.ok).toBe(false)
      expect(missing.exitCode).toBe(1)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('skills:status action', () => {
  test('aggregates ledger, mirrors, installed, recommendations', async () => {
    const root = fixtureRepo()
    try {
      writeFileSync(
        join(root, 'skills.json'),
        `${JSON.stringify([
          { name: 'm', source: 'mirror', repo: 'r/x', path: 'p', commit: 'old' },
          { name: 'o', source: 'official', repo: 'own/rep' },
        ])}\n`,
      )
      const run: ActionContext['run'] = async (cmd) =>
        cmd === 'gh' ? { code: 0, stdout: 'new\n', stderr: '' } : { code: 0, stdout: 'skill-a\nskill-b\n', stderr: '' }
      const result = await getAction('skills:status').execute(testContext(root, { run }), { positionals: [], flags: {} })
      expect(result.exitCode).toBe(1)
      const data = result.data as { mirrors: { outdated: boolean }[]; installed: string[]; recommendations: { name: string }[] }
      expect(data.mirrors[0]?.outdated).toBe(true)
      expect(data.installed).toEqual(['skill-a', 'skill-b'])
      expect(data.recommendations[0]?.name).toBe('o')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('adopt action', () => {
  test('records lock baseline for untracked asset; rejects non-untracked', async () => {
    const root = fixtureRepo()
    try {
      mkdirSync(join(root, 'rules/global'), { recursive: true })
      writeFileSync(join(root, 'rules/global/foo.md'), '# foo\n')
      const ok = await getAction('adopt').execute(testContext(root), { positionals: ['foo'], flags: {} })
      expect(ok.ok).toBe(true)
      const lock = JSON.parse(readFileSync(join(root, 'artifacts.lock.json'), 'utf8')) as Record<string, unknown>
      expect(lock['rule:foo']).toBeDefined()
      const again = await getAction('adopt').execute(testContext(root), { positionals: ['foo'], flags: {} })
      expect(again.ok).toBe(false)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('build action', () => {
  test('claude success path verifies artifact and records lock', async () => {
    const root = fixtureRepo()
    try {
      const claude: ActionContext['claude'] = async (opts) => {
        mkdirSync(join(root, 'rules/global'), { recursive: true })
        writeFileSync(join(root, 'rules/global/foo.md'), '# built\n')
        opts.onText?.('building')
        return { code: 0, timedOut: false, stderr: '' }
      }
      const texts: string[] = []
      const result = await getAction('build').execute(
        testContext(root, { claude }),
        { positionals: ['foo'], flags: {} },
        { onText: (t) => texts.push(t) },
      )
      expect(result.ok).toBe(true)
      const lock = JSON.parse(readFileSync(join(root, 'artifacts.lock.json'), 'utf8')) as Record<string, unknown>
      expect(lock['rule:foo']).toBeDefined()
      expect(texts).toContain('building')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  test('claude failure leaves lock untouched; stub and unknown assets rejected', async () => {
    const root = fixtureRepo()
    try {
      writeFileSync(join(root, 'meta/rules/bar.md'), '---\nname: bar\ntarget: rule\nstatus: stub\n---\n')
      const claude: ActionContext['claude'] = async () => ({ code: 1, timedOut: false, stderr: 'boom' })
      const failRes = await getAction('build').execute(testContext(root, { claude }), { positionals: ['foo'], flags: {} })
      expect(failRes.ok).toBe(false)
      expect(existsSync(join(root, 'artifacts.lock.json'))).toBe(false)
      const stub = await getAction('build').execute(testContext(root), { positionals: ['bar'], flags: {} })
      expect(stub.ok).toBe(false)
      expect(stub.message).toMatch(/stub/u)
      const unknown = await getAction('build').execute(testContext(root), { positionals: ['nope'], flags: {} })
      expect(unknown.ok).toBe(false)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  test('batch failure message lists already-built assets', async () => {
    const root = fixtureRepo()
    try {
      writeFileSync(
        join(root, 'meta/rules/baz.md'),
        '---\nname: baz\ntarget: rule\nstatus: ready\nscope: global\n---\nbody\n',
      )
      const claude: ActionContext['claude'] = async (opts) => {
        if (opts.prompt.includes('foo')) {
          mkdirSync(join(root, 'rules/global'), { recursive: true })
          writeFileSync(join(root, 'rules/global/foo.md'), '# built\n')
          return { code: 0, timedOut: false, stderr: '' }
        }
        return { code: 1, timedOut: false, stderr: 'boom' }
      }
      const result = await getAction('build').execute(testContext(root, { claude }), {
        positionals: ['foo', 'baz'],
        flags: {},
      })
      expect(result.ok).toBe(false)
      expect(result.message).toContain('baz:')
      expect(result.message).toContain('already built: foo')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  test('--stale with nothing stale is a no-op success', async () => {
    const root = fixtureRepo()
    try {
      const result = await getAction('build').execute(testContext(root), { positionals: [], flags: { stale: true } })
      expect(result.ok).toBe(true)
      expect(result.message).toBe('no stale assets')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  test('--stale with explicit asset names fails', async () => {
    const root = fixtureRepo()
    try {
      const result = await getAction('build').execute(testContext(root), {
        positionals: ['foo'],
        flags: { stale: true },
      })
      expect(result.ok).toBe(false)
      expect(result.message).toMatch(/--stale/u)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  test('build emits verify and record steps via onStep', async () => {
    const root = fixtureRepo()
    try {
      const claude: ActionContext['claude'] = async () => {
        mkdirSync(join(root, 'rules/global'), { recursive: true })
        writeFileSync(join(root, 'rules/global/foo.md'), '# built\n')
        return { code: 0, timedOut: false, stderr: '' }
      }
      const steps: [string, Record<string, unknown> | undefined][] = []
      const result = await getAction('build').execute(
        testContext(root, { claude }),
        { positionals: ['foo'], flags: {} },
        { onStep: (step, data) => steps.push([step, data]) },
      )
      expect(result.ok).toBe(true)
      expect(steps[0]?.[0]).toBe('verify')
      expect(steps[0]?.[1]?.ok).toBe(true)
      expect(steps[1]?.[0]).toBe('record')
      expect(steps[1]?.[1]?.key).toBe('rule:foo')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('build preBuildCheck gate', () => {
  test('skill build aborts before claude when upstream has the name', async () => {
    const root = fixtureRepo()
    try {
      mkdirSync(join(root, 'meta/skills'), { recursive: true })
      writeFileSync(join(root, 'meta/skills/dup.md'), '---\nname: dup\nstatus: ready\n---\nbody\n')
      let claudeCalled = false
      const claude: ActionContext['claude'] = async () => {
        claudeCalled = true
        return { code: 0, timedOut: false, stderr: '' }
      }
      const fetchJson = async () => ({ files: [{ path: 'plugins/p/skills/dup/SKILL.md' }] })
      const result = await getAction('build').execute(
        testContext(root, { claude, fetchJson }),
        { positionals: ['dup'], flags: {} },
      )
      expect(result.ok).toBe(false)
      expect(result.message).toMatch(/official/u)
      expect(claudeCalled).toBe(false)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  test('fetch failure fails the build rather than skipping the check', async () => {
    const root = fixtureRepo()
    try {
      mkdirSync(join(root, 'meta/skills'), { recursive: true })
      writeFileSync(join(root, 'meta/skills/dup.md'), '---\nname: dup\nstatus: ready\n---\nbody\n')
      const fetchJson = async () => {
        throw new Error('network down')
      }
      const result = await getAction('build').execute(
        testContext(root, { fetchJson }),
        { positionals: ['dup'], flags: {} },
      )
      expect(result.ok).toBe(false)
      expect(result.message).toMatch(/pre-build check failed/u)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('writeback action', () => {
  test('requires dirty status', async () => {
    const root = fixtureRepo()
    try {
      syncLock(root)
      const notDirty = await getAction('writeback').execute(testContext(root), { positionals: ['foo'], flags: {} })
      expect(notDirty.ok).toBe(false)
      expect(notDirty.message).toMatch(/not dirty/u)
      writeFileSync(join(root, 'rules/global/foo.md'), '# edited\n')
      const claude: ActionContext['claude'] = async () => ({ code: 0, timedOut: false, stderr: '' })
      const dirty = await getAction('writeback').execute(testContext(root, { claude }), { positionals: ['foo'], flags: {} })
      expect(dirty.ok).toBe(true)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('skills mutations', () => {
  test('skills:fix adds unledgered dirs and reports remaining issues', async () => {
    const root = fixtureRepo()
    try {
      mkdirSync(join(root, 'skills/extra'), { recursive: true })
      writeFileSync(join(root, 'skills/extra/SKILL.md'), '---\nname: extra\n---\n')
      const result = await getAction('skills:fix').execute(testContext(root), { positionals: [], flags: {} })
      expect(result.ok).toBe(true)
      expect(result.message).toContain('extra')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  test('skills:update updates only outdated mirrors via injected download', async () => {
    const root = fixtureRepo()
    try {
      writeFileSync(
        join(root, 'skills.json'),
        `${JSON.stringify([{ name: 'm', source: 'mirror', repo: 'r/x', path: 'p', commit: 'old' }])}\n`,
      )
      const downloads: string[] = []
      const run: ActionContext['run'] = async () => ({ code: 0, stdout: 'new\n', stderr: '' })
      const download: ActionContext['download'] = async (input) => {
        downloads.push(input)
        return {}
      }
      const result = await getAction('skills:update').execute(
        testContext(root, { run, download }),
        { positionals: [], flags: {} },
      )
      expect(result.ok).toBe(true)
      expect(downloads).toEqual(['gh:r/x/p'])
      const ledger = JSON.parse(readFileSync(join(root, 'skills.json'), 'utf8')) as { commit: string }[]
      expect(ledger[0]?.commit).toBe('new')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  test('skills:update mid-loop failure reports already-updated mirrors and keeps ledger consistent', async () => {
    const root = fixtureRepo()
    try {
      writeFileSync(
        join(root, 'skills.json'),
        `${JSON.stringify([
          { name: 'm1', source: 'mirror', repo: 'r/x', path: 'p1', commit: 'old' },
          { name: 'm2', source: 'mirror', repo: 'r/x', path: 'p2', commit: 'old' },
        ])}\n`,
      )
      const run: ActionContext['run'] = async () => ({ code: 0, stdout: 'new\n', stderr: '' })
      const download: ActionContext['download'] = async (input) => {
        if (input === 'gh:r/x/p2') throw new Error('download failed')
        return {}
      }
      const result = await getAction('skills:update').execute(
        testContext(root, { run, download }),
        { positionals: [], flags: {} },
      )
      expect(result.ok).toBe(false)
      expect(result.message).toContain('already updated: m1')
      const ledger = JSON.parse(readFileSync(join(root, 'skills.json'), 'utf8')) as { commit: string }[]
      expect(ledger[0]?.commit).toBe('new')
      expect(ledger[1]?.commit).toBe('old')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('runAction', () => {
  test('mutation writes a run log with the full step sequence', async () => {
    const root = fixtureRepo()
    try {
      const claude: ActionContext['claude'] = async (opts) => {
        mkdirSync(join(root, 'rules/global'), { recursive: true })
        writeFileSync(join(root, 'rules/global/foo.md'), '# built\n')
        opts.onEvent?.({ type: 'assistant', message: { content: [{ type: 'text', text: 'hi' }] } })
        opts.onText?.('hi')
        return { code: 0, timedOut: false, stderr: '' }
      }
      const result = await runAction(testContext(root, { claude }), 'build', {
        positionals: ['foo'],
        flags: {},
      })
      expect(result.ok).toBe(true)
      expect(result.logPath).toBeDefined()
      const lines = readFileSync(result.logPath ?? '', 'utf8')
        .trim()
        .split('\n')
        .map((l) => JSON.parse(l) as Record<string, unknown>)
      const steps = lines.map((l) => l.step)
      // first 'text' is buildAction's '--- foo ---' separator (hooks.onText fires before claude spawns);
      // second 'text' is claude streaming output forwarded through the same wrapped hook
      expect(steps).toEqual(['start', 'text', 'claude:spawn', 'claude:event', 'text', 'claude:exit', 'verify', 'record', 'result'])
      expect(lines[1]?.text).toBe('--- foo ---')
      expect(lines[4]?.text).toBe('hi')
      expect(lines.every((l) => l.action === 'build')).toBe(true)
      const spawn = lines[2]
      expect(String(spawn?.prompt)).toContain('meta/rules/foo.md')
      expect(String(spawn?.allowedTools)).toContain('Write(rules/**)')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  test('failed mutation still returns logPath and logs a failed result', async () => {
    const root = fixtureRepo()
    try {
      const claude: ActionContext['claude'] = async () => ({ code: 1, timedOut: false, stderr: 'boom' })
      const result = await runAction(testContext(root, { claude }), 'build', {
        positionals: ['foo'],
        flags: {},
      })
      expect(result.ok).toBe(false)
      expect(result.logPath).toBeDefined()
      const lines = readFileSync(result.logPath ?? '', 'utf8')
        .trim()
        .split('\n')
        .map((l) => JSON.parse(l) as Record<string, unknown>)
      const last = lines.at(-1)
      expect(last?.step).toBe('result')
      expect(last?.ok).toBe(false)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  test('query actions produce no log directory', async () => {
    const root = fixtureRepo()
    try {
      const result = await runAction(testContext(root), 'status', { positionals: [], flags: {} })
      expect(result.ok).toBe(true)
      expect(result.logPath).toBeUndefined()
      expect(existsSync(join(root, '.imeta'))).toBe(false)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  test('createRunLog failure does not block the action; result has no logPath', async () => {
    const root = fixtureRepo()
    try {
      mkdirSync(join(root, 'rules/global'), { recursive: true })
      writeFileSync(join(root, 'rules/global/foo.md'), '# foo\n')
      // a file named .imeta makes mkdirSync inside createRunLog throw ENOTDIR
      writeFileSync(join(root, '.imeta'), '')
      const result = await runAction(testContext(root), 'adopt', { positionals: ['foo'], flags: {} })
      expect(result.ok).toBe(true)
      expect(result.logPath).toBeUndefined()
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  test('caller onText receives text and the log records text steps', async () => {
    const root = fixtureRepo()
    try {
      const claude: ActionContext['claude'] = async (opts) => {
        mkdirSync(join(root, 'rules/global'), { recursive: true })
        writeFileSync(join(root, 'rules/global/foo.md'), '# built\n')
        opts.onText?.('streamed line')
        return { code: 0, timedOut: false, stderr: '' }
      }
      const texts: string[] = []
      const result = await runAction(
        testContext(root, { claude }),
        'build',
        { positionals: ['foo'], flags: {} },
        { onText: (t) => texts.push(t) },
      )
      expect(result.ok).toBe(true)
      expect(texts).toEqual(['--- foo ---', 'streamed line'])
      const lines = readFileSync(result.logPath ?? '', 'utf8')
        .trim()
        .split('\n')
        .map((l) => JSON.parse(l) as Record<string, unknown>)
      const textSteps = lines.filter((l) => l.step === 'text').map((l) => l.text)
      expect(textSteps).toEqual(['--- foo ---', 'streamed line'])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
