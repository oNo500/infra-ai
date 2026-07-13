import { marked } from 'marked'

export interface ParsedDoc {
  frontmatter: string | null
  html: string
}

export function parseDoc(content: string): ParsedDoc {
  const match = /^---\n([\s\S]*?)\n---\n?/u.exec(content)
  const frontmatter = match ? (match[1] ?? null) : null
  const body = match ? content.slice(match[0].length) : content
  return { frontmatter, html: marked.parse(body, { async: false }) }
}
