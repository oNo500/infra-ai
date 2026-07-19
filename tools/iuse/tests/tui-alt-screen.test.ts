import { describe, expect, test } from 'bun:test'
import { enterAltScreen, leaveAltScreen } from '../src/tui/app'

/** Minimal injectable writable -- avoids depending on a real TTY stream in unit tests. */
function fakeWritable(isTTY: boolean): { isTTY: boolean; writes: string[]; write: (data: string) => void } {
  const writes: string[] = []
  return {
    isTTY,
    writes,
    write: (data: string) => {
      writes.push(data)
    },
  }
}

describe('alt-screen helpers', () => {
  test('enterAltScreen writes the enter sequence when isTTY', () => {
    const stdout = fakeWritable(true)
    enterAltScreen(stdout)
    expect(stdout.writes).toEqual(['\x1b[?1049h'])
  })

  test('leaveAltScreen writes the leave sequence when isTTY', () => {
    const stdout = fakeWritable(true)
    leaveAltScreen(stdout)
    expect(stdout.writes).toEqual(['\x1b[?1049l'])
  })

  test('enterAltScreen is a no-op when not a TTY (fake stdout in tests)', () => {
    const stdout = fakeWritable(false)
    enterAltScreen(stdout)
    expect(stdout.writes).toEqual([])
  })

  test('leaveAltScreen is a no-op when not a TTY', () => {
    const stdout = fakeWritable(false)
    leaveAltScreen(stdout)
    expect(stdout.writes).toEqual([])
  })
})
