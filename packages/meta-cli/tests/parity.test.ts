import { describe, expect, test } from 'bun:test'
import { buildMainCommand } from '../src/cli/index'
import { ACTIONS } from '../src/core/actions'
import { KEYMAP } from '../src/tui/keymap'

describe('frontend parity', () => {
  test('every registry action is reachable from the TUI keymap', () => {
    const mapped = new Set(KEYMAP.map((e) => e.actionId))
    for (const action of ACTIONS) {
      expect(mapped.has(action.id), `action ${action.id} missing from keymap`).toBe(true)
    }
  })
  test('keymap references only real actions', () => {
    const ids = new Set(ACTIONS.map((a) => a.id))
    for (const entry of KEYMAP) {
      expect(ids.has(entry.actionId), `keymap references unknown action ${entry.actionId}`).toBe(true)
    }
  })
  test('CLI command tree covers exactly the registry ids', async () => {
    const main = buildMainCommand()
    const subCommands = (await Promise.resolve(main.subCommands)) as Record<string, unknown>
    const ids: string[] = []
    for (const [name, sub] of Object.entries(subCommands)) {
      const resolved = (await Promise.resolve(sub)) as { subCommands?: Record<string, unknown> }
      if (resolved.subCommands) {
        for (const leaf of Object.keys(resolved.subCommands)) ids.push(`${name}:${leaf}`)
      } else {
        ids.push(name)
      }
    }
    expect(new Set(ids)).toEqual(new Set(ACTIONS.map((a) => a.id)))
  })
})
