import { describe, expect, test } from 'bun:test'
import { listWindow } from '../src/tui/browse-view'

describe('listWindow', () => {
  describe('tiny terminal protection (maxRows <= 2)', () => {
    test('maxRows=1: shows only the cursor line', () => {
      const result = listWindow(10, 5, 1)
      expect(result.start).toBeLessThanOrEqual(result.end)
      expect(result.start).toBeLessThanOrEqual(5)
      expect(result.end).toBeGreaterThan(5)
      expect(result.end - result.start).toBeLessThanOrEqual(1)
    })

    test('maxRows=2: cursor line included, start <= end', () => {
      const result = listWindow(10, 5, 2)
      expect(result.start).toBeLessThanOrEqual(result.end)
      expect(result.start).toBeLessThanOrEqual(5)
      expect(result.end).toBeGreaterThan(5)
      expect(result.end - result.start).toBeLessThanOrEqual(2)
    })

    test('maxRows=1 cursor at head', () => {
      const result = listWindow(10, 0, 1)
      expect(result.start).toBeLessThanOrEqual(result.end)
      expect(result.start).toEqual(0)
      expect(result.end).toBeGreaterThan(0)
    })

    test('maxRows=1 cursor at tail', () => {
      const result = listWindow(10, 9, 1)
      expect(result.start).toBeLessThanOrEqual(result.end)
      expect(result.start).toBeLessThanOrEqual(9)
      expect(result.end).toBeGreaterThan(9)
    })

    test('maxRows=2 cursor at head', () => {
      const result = listWindow(10, 0, 2)
      expect(result.start).toBeLessThanOrEqual(result.end)
      expect(result.start).toEqual(0)
      expect(result.end - result.start).toBeLessThanOrEqual(2)
    })

    test('maxRows=2 cursor at tail', () => {
      const result = listWindow(10, 9, 2)
      expect(result.start).toBeLessThanOrEqual(result.end)
      expect(result.start).toBeLessThanOrEqual(9)
      expect(result.end - result.start).toBeLessThanOrEqual(2)
    })

    test('maxRows=2 cursor in middle', () => {
      const result = listWindow(10, 5, 2)
      expect(result.start).toBeLessThanOrEqual(result.end)
      expect(result.start).toBeLessThanOrEqual(5)
      expect(result.end - result.start).toBeLessThanOrEqual(2)
    })
  })

  describe('normal cases (maxRows >= 3)', () => {
    test('small list (length <= maxRows) shows entire list', () => {
      const result = listWindow(5, 2, 10)
      expect(result.start).toEqual(0)
      expect(result.end).toEqual(5)
      expect(result.hasMoreAbove).toBe(false)
      expect(result.hasMoreBelow).toBe(false)
    })

    test('cursor is always included in the window', () => {
      const result = listWindow(20, 10, 5)
      expect(result.start).toBeLessThanOrEqual(10)
      expect(result.end).toBeGreaterThan(10)
    })

    test('window respects maxRows budget', () => {
      const result = listWindow(20, 10, 5)
      expect(result.end - result.start).toBeLessThanOrEqual(5)
    })

    test('centers cursor when there is slack', () => {
      const result = listWindow(20, 10, 5)
      const distFromStart = 10 - result.start
      const distFromEnd = result.end - 10
      expect(Math.abs(distFromStart - distFromEnd)).toBeLessThanOrEqual(1)
    })

    test('clamps to start when cursor is near head', () => {
      const result = listWindow(20, 1, 5)
      expect(result.start).toEqual(0)
      expect(result.end - result.start).toBeLessThanOrEqual(5)
    })

    test('clamps to end when cursor is near tail', () => {
      const result = listWindow(20, 18, 5)
      expect(result.end).toEqual(20)
      expect(result.end - result.start).toBeLessThanOrEqual(5)
    })
  })

  describe('start <= end invariant', () => {
    test('invariant holds for all cursor positions with maxRows=1', () => {
      for (let cursor = 0; cursor < 10; cursor++) {
        const result = listWindow(10, cursor, 1)
        expect(result.start).toBeLessThanOrEqual(result.end)
      }
    })

    test('invariant holds for all cursor positions with maxRows=2', () => {
      for (let cursor = 0; cursor < 10; cursor++) {
        const result = listWindow(10, cursor, 2)
        expect(result.start).toBeLessThanOrEqual(result.end)
      }
    })

    test('invariant holds for all cursor positions with maxRows=3', () => {
      for (let cursor = 0; cursor < 10; cursor++) {
        const result = listWindow(10, cursor, 3)
        expect(result.start).toBeLessThanOrEqual(result.end)
      }
    })
  })
})
