import { defineCommand, runMain } from 'citty'
import type { ArgsDef, CommandDef } from 'citty'
import { ACTIONS, defaultContext } from '../core/actions'
import type { ActionDef, ActionParams, SkillsStatusData, StatusRowData } from '../core/actions'
import type { Target } from '../core/registry'
import { renderSkills, renderStatus, renderTargets } from './render'

const QUERY_RENDERERS: Record<string, (data: unknown) => string> = {
  status: (d) => renderStatus(d as StatusRowData[]),
  'targets:list': (d) => renderTargets(d as Target[]),
  'skills:status': (d) => renderSkills(d as SkillsStatusData),
}

function usage(action: ActionDef): string {
  const positionals = action.args
    .filter((a) => a.kind === 'positional')
    .map((a) => {
      const name = a.variadic ? `${a.name}...` : a.name
      return a.required ? `<${name}>` : `[${name}]`
    })
    .join(' ')
  return positionals === '' ? action.summary : `${action.summary} (usage: ${positionals})`
}

function paramsFrom(args: Record<string, unknown>): ActionParams {
  const raw = args._
  const positionals = Array.isArray(raw) ? raw.map(String) : []
  const flags: Record<string, boolean> = {}
  for (const [key, value] of Object.entries(args)) {
    if (key !== '_' && typeof value === 'boolean') flags[key] = value
  }
  return { positionals, flags }
}

function commandFor(action: ActionDef): CommandDef {
  const args: ArgsDef = {}
  for (const spec of action.args) {
    if (spec.kind === 'flag') args[spec.name] = { type: 'boolean', description: spec.description }
  }
  if (action.kind === 'query') args.json = { type: 'boolean', description: 'output JSON' }
  const leaf = action.id.includes(':') ? action.id.slice(action.id.indexOf(':') + 1) : action.id
  return defineCommand({
    meta: { name: leaf, description: usage(action) },
    args,
    async run(cmdCtx) {
      const cmdArgs = cmdCtx.args as Record<string, unknown>
      const params = paramsFrom(cmdArgs)
      const result = await action.execute(defaultContext(process.cwd()), params, {
        onText: (t) => console.log(t),
      })
      if (!result.ok) {
        console.error(result.message ?? 'failed')
      } else if (action.kind === 'query') {
        const renderer = QUERY_RENDERERS[action.id]
        console.log(
          cmdArgs.json === true || renderer === undefined
            ? JSON.stringify(result.data, null, 2)
            : renderer(result.data),
        )
      } else if (result.message) {
        console.log(result.message)
      }
      process.exitCode = result.exitCode ?? (result.ok ? 0 : 1)
    },
  })
}

export function buildMainCommand(): CommandDef {
  const subCommands: Record<string, CommandDef> = {}
  const groups = new Map<string, Record<string, CommandDef>>()
  for (const action of ACTIONS) {
    if (action.id.includes(':')) {
      const group = action.id.slice(0, action.id.indexOf(':'))
      const leaf = action.id.slice(action.id.indexOf(':') + 1)
      const entry = groups.get(group) ?? {}
      entry[leaf] = commandFor(action)
      groups.set(group, entry)
    } else {
      subCommands[action.id] = commandFor(action)
    }
  }
  for (const [group, leaves] of groups) {
    subCommands[group] = defineCommand({
      meta: { name: group, description: `${group} operations` },
      subCommands: leaves,
    })
  }
  return defineCommand({
    meta: { name: 'meta', description: 'infra-ai meta asset maintenance' },
    subCommands,
  })
}

export async function runCli(): Promise<void> {
  await runMain(buildMainCommand())
}
