import { join } from 'node:path'
import type { IuseContext } from './init'
import { listProfiles } from './profiles'
import type { ProfileInfo } from './profiles'
import { resolveSource } from './source'

export interface ProfilesResult {
  ok: boolean
  message?: string
  profilesText?: string
  profiles?: ProfileInfo[]
  exitCode: number
}

export async function profilesReport(
  ctx: IuseContext,
  opts: { source?: string },
): Promise<ProfilesResult> {
  let source: Awaited<ReturnType<typeof resolveSource>>
  try {
    source = await resolveSource({
      explicit: opts.source,
      envRoot: ctx.env.INFRA_AI_ROOT,
      homeDefault: join(ctx.home, 'code/infra-ai'),
      cacheDir: ctx.cacheDir,
      download: ctx.download,
      run: ctx.run,
    })
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error), exitCode: 1 }
  }

  let profiles: ReturnType<typeof listProfiles>
  try {
    profiles = listProfiles(source.root)
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error), exitCode: 1 }
  }

  if (profiles.length === 0) {
    return { ok: true, profilesText: '', profiles, exitCode: 0 }
  }

  const lines: string[] = []
  for (const profile of profiles) {
    const ruleCount = profile.rules.length
    const ruleLabel = ruleCount === 1 ? 'rule' : 'rules'
    lines.push(`${profile.name}  ${ruleCount} ${ruleLabel}  ${profile.description}`)
    for (const rule of profile.rules) {
      lines.push(`  ${rule}`)
    }
  }

  return { ok: true, profilesText: lines.join('\n'), profiles, exitCode: 0 }
}
