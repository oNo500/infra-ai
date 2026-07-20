import { join } from 'node:path'
import Ajv from 'ajv'
import type { ValidateFunction } from 'ajv'
import catalogSchema from '../../../../schema/catalog.schema.json'
import profilesSchema from '../../../../schema/profiles.schema.json'
import type { Catalog } from './contract-gen/catalog'
import type { Profiles } from './contract-gen/profiles'
import { readTextIfExists } from './io'

export type { Catalog, CatalogRule, TagFacet, TagVocabulary } from './contract-gen/catalog'
export type { Profile, Profiles } from './contract-gen/profiles'

const ajv = new Ajv({ allErrors: true })
const validators = {
  catalog: ajv.compile(catalogSchema),
  profiles: ajv.compile(profilesSchema),
}

const SCHEMA_HINT =
  'source does not match the schema bundled with this iuse checkout -- update the checkout (git pull in the infra-ai repo) or fix the source data'

function loadValidated(root: string, filename: string, validate: ValidateFunction): unknown {
  const raw = readTextIfExists(join(root, filename))
  if (raw === null) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new Error(`${filename}: invalid JSON (${String(error)})`, { cause: error })
  }
  if (!validate(parsed)) {
    const detail = (validate.errors ?? [])
      .map((e) => `${e.instancePath === '' ? '/' : e.instancePath} ${e.message ?? 'invalid'}`)
      .join('; ')
    throw new Error(`${filename}: ${detail} (${SCHEMA_HINT})`)
  }
  return parsed
}

export function loadCatalog(root: string): Catalog | null {
  return loadValidated(root, 'catalog.json', validators.catalog) as Catalog | null
}

export function loadProfiles(root: string): Profiles {
  return (loadValidated(root, 'profiles.json', validators.profiles) as Profiles | null) ?? {}
}
