import { join } from 'node:path'
import { readTextIfExists, writeFileAtomic } from './io'

export interface Target {
  path: string
  subscriptions: string[]
}

export interface LockEntry {
  metaHash: string
  artifactHash: string
  builtAt: string
}

export type Lock = Record<string, LockEntry>

export interface SkillEntry {
  name: string
  source: 'custom' | 'mirror' | 'official'
  repo?: string
  path?: string
  commit?: string
  updated?: string
}

export class RegistryError extends Error {}

function parseJsonFile<T>(repoRoot: string, filename: string): T | null {
  const raw = readTextIfExists(join(repoRoot, filename))
  if (raw === null) return null
  try {
    return JSON.parse(raw) as T
  } catch (e) {
    throw new RegistryError(`${filename}: invalid JSON (${String(e)})`)
  }
}

function saveJsonFile(repoRoot: string, filename: string, data: unknown): void {
  writeFileAtomic(join(repoRoot, filename), `${JSON.stringify(data, null, 2)}\n`)
}

export function loadTargets(repoRoot: string): Target[] {
  return parseJsonFile<Target[]>(repoRoot, 'targets.json') ?? []
}

export function saveTargets(repoRoot: string, targets: Target[]): void {
  saveJsonFile(repoRoot, 'targets.json', targets)
}

export function loadLock(repoRoot: string): Lock {
  return parseJsonFile<Lock>(repoRoot, 'artifacts.lock.json') ?? {}
}

export function saveLock(repoRoot: string, lock: Lock): void {
  saveJsonFile(repoRoot, 'artifacts.lock.json', lock)
}

export function loadSkills(repoRoot: string): SkillEntry[] {
  const skills = parseJsonFile<SkillEntry[]>(repoRoot, 'skills.json')
  if (skills === null) throw new RegistryError('skills.json: file not found')
  return skills
}

export function saveSkills(repoRoot: string, skills: SkillEntry[]): void {
  saveJsonFile(repoRoot, 'skills.json', skills)
}
