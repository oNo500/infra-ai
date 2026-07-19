import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { GEN_DIR, SCHEMA_NAMES, generate } from '../scripts/codegen'

test('generated contract types are current with the published schemas', async () => {
  for (const name of SCHEMA_NAMES) {
    const expected = await generate(name)
    const actual = readFileSync(join(GEN_DIR, `${name}.ts`), 'utf8')
    expect(actual).toBe(expected)
  }
})
