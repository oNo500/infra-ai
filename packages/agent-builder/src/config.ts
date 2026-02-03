/**
 * Agent configurations
 */

import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Directory paths
export const AGENTS_DIR = join(__dirname, '../../..', 'agents')
export const SKILLS_DIR = join(__dirname, '../../..', 'skills')

// List of available agents
// Configuration is loaded from agents/{name}/metadata.json
export const agentNames = ['nextjs-architecture', 'react-best-practices']
