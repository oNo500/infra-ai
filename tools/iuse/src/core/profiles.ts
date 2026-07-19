import { loadProfiles as loadProfilesFromMeta } from './contract'

export interface ProfileInfo {
  name: string
  description: string
  rules: string[]
}

export function listProfiles(sourceRoot: string): ProfileInfo[] {
  const profiles = loadProfilesFromMeta(sourceRoot)
  return Object.entries(profiles)
    .map(([name, profile]) => ({
      name,
      description: profile.description ?? '',
      rules: profile.rules,
    }))
    .toSorted((a, b) => a.name.localeCompare(b.name))
}
