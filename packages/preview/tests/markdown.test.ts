import { describe, expect, test } from 'bun:test'
import { parseDoc } from '@/lib/markdown'

describe('parseDoc', () => {
  test('splits frontmatter and renders body to html', () => {
    const { frontmatter, html } = parseDoc('---\nname: x\n---\n# Title\n\n- item\n')
    expect(frontmatter).toBe('name: x')
    expect(html).toContain('<h1')
    expect(html).toContain('<li>')
  })
  test('no frontmatter yields null and full render', () => {
    const { frontmatter, html } = parseDoc('plain **bold**\n')
    expect(frontmatter).toBeNull()
    expect(html).toContain('<strong>')
  })
})
