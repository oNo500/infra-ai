/**
 * Type definitions for agent-builder
 */

export type ImpactLevel =
  | 'CRITICAL'
  | 'HIGH'
  | 'MEDIUM-HIGH'
  | 'MEDIUM'
  | 'LOW-MEDIUM'
  | 'LOW'

export interface Rule {
  id: string
  title: string
  impact: ImpactLevel
  impactDescription?: string
  explanation: string
  examples: CodeExample[]
}

export interface CodeExample {
  label: string
  description?: string
  code: string
  language: string
  additionalText?: string
}

export interface Section {
  number: number
  title: string
  impact: ImpactLevel
  description?: string
  rules: Rule[]
}

export interface SectionConfig {
  id: string
  title: string
  impact: ImpactLevel
  description?: string
}

export interface MetadataConfig {
  title: string
  version?: string
  organization?: string
  date?: string
  abstract: string
  references?: string[]
  sections: SectionConfig[]
}

export interface AgentConfig {
  name: string
  metadata: MetadataConfig
}
