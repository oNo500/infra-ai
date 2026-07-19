import { describe, expect, test } from 'bun:test'
import { listWindow } from '../src/tui/browse-view'

describe('listWindow', () => {
  test('tiny terminal (maxRows<=2): cursor always included, start<=end, window size never exceeds maxRows, both at head and tail', () => {
    for (const maxRows of [1, 2]) {
      const atHead = listWindow(10, 0, maxRows)
      expect(atHead.start).toBe(0)
      expect(atHead.end).toBeGreaterThan(0)
      expect(atHead.end - atHead.start).toBeLessThanOrEqual(maxRows)

      const atTail = listWindow(10, 9, maxRows)
      expect(atTail.start).toBeLessThanOrEqual(9)
      expect(atTail.end).toBeGreaterThan(9)
      expect(atTail.end - atTail.start).toBeLessThanOrEqual(maxRows)

      const inMiddle = listWindow(10, 5, maxRows)
      expect(inMiddle.start).toBeLessThanOrEqual(inMiddle.end)
      expect(inMiddle.start).toBeLessThanOrEqual(5)
      expect(inMiddle.end).toBeGreaterThan(5)
      expect(inMiddle.end - inMiddle.start).toBeLessThanOrEqual(maxRows)
    }
  })

  test('small list (length <= maxRows) shows the entire list with no more-above/below flags', () => {
    const result = listWindow(5, 2, 10)
    expect(result.start).toEqual(0)
    expect(result.end).toEqual(5)
    expect(result.hasMoreAbove).toBe(false)
    expect(result.hasMoreBelow).toBe(false)
  })

  test('normal window (maxRows>=3): cursor included, budget respected, centered with slack', () => {
    const result = listWindow(20, 10, 5)
    expect(result.start).toBeLessThanOrEqual(10)
    expect(result.end).toBeGreaterThan(10)
    expect(result.end - result.start).toBeLessThanOrEqual(5)
    const distFromStart = 10 - result.start
    const distFromEnd = result.end - 10
    expect(Math.abs(distFromStart - distFromEnd)).toBeLessThanOrEqual(1)
  })

  test('clamps to the list bounds when the cursor is near the head or tail', () => {
    const nearHead = listWindow(20, 1, 5)
    expect(nearHead.start).toEqual(0)
    expect(nearHead.end - nearHead.start).toBeLessThanOrEqual(5)

    const nearTail = listWindow(20, 18, 5)
    expect(nearTail.end).toEqual(20)
    expect(nearTail.end - nearTail.start).toBeLessThanOrEqual(5)
  })

  test('start <= end invariant holds for every cursor position at the smallest maxRows values', () => {
    for (const maxRows of [1, 2, 3]) {
      for (let cursor = 0; cursor < 10; cursor++) {
        const result = listWindow(10, cursor, maxRows)
        expect(result.start).toBeLessThanOrEqual(result.end)
      }
    }
  })
})
