import { expect, test } from 'bun:test'
import { loadProfiles, sha256, validateComposition } from '@infra-ai/meta-cli/core'

test('barrel exposes composition and io surface', () => {
  expect(typeof loadProfiles).toBe('function')
  expect(typeof validateComposition).toBe('function')
  expect(sha256('a')).toHaveLength(64)
})
