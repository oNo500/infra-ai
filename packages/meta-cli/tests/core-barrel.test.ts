import { describe, expect, test } from 'bun:test'
import { loadOverview, readTextIfExists } from '../src/core/index'

describe('core barrel', () => {
  test('re-exports the read-side surface preview depends on', () => {
    expect(typeof loadOverview).toBe('function')
    expect(typeof readTextIfExists).toBe('function')
  })
})
