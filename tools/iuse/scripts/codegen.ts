#!/usr/bin/env bun
import { join } from 'node:path'
import { compileFromFile } from 'json-schema-to-typescript'
import { writeFileAtomic } from '../src/core/io'

// tools/iuse/scripts -> infra-ai repo root; the schemas published there are
// the same files this checkout validates sources against (lockstep by repo).
export const SCHEMA_DIR = join(import.meta.dir, '../../../schema')
export const GEN_DIR = join(import.meta.dir, '../src/core/contract-gen')
export const SCHEMA_NAMES = ['catalog', 'profiles'] as const

export const CODEGEN_OPTIONS = {
  bannerComment:
    '/* AUTO-GENERATED from ../../schema by scripts/codegen.ts -- do not edit. Regenerate: bun run codegen */',
  additionalProperties: false,
} as const

export async function generate(name: (typeof SCHEMA_NAMES)[number]): Promise<string> {
  return compileFromFile(join(SCHEMA_DIR, `${name}.schema.json`), CODEGEN_OPTIONS)
}

if (import.meta.main) {
  for (const name of SCHEMA_NAMES) {
    writeFileAtomic(join(GEN_DIR, `${name}.ts`), await generate(name))
    console.log(`generated src/core/contract-gen/${name}.ts`)
  }
}
