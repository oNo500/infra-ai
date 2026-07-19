import { describe, expect, test } from 'bun:test'
import { renderRule } from '../src/core/render'

describe('renderRule', () => {
  test('global scope is identity', () => {
    expect(renderRule('global', '# Constitution\n')).toBe('# Constitution\n')
  })
  test('null scope is identity', () => {
    expect(renderRule(null, '# X\n')).toBe('# X\n')
  })
  test('glob scope prepends paths frontmatter with exact byte format', () => {
    expect(renderRule('**/*.css', '# CSS\n')).toBe('---\npaths:\n  - "**/*.css"\n---\n\n# CSS\n')
  })
})
