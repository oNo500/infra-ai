import { existsSync } from 'node:fs'
import { join } from 'node:path'

export interface SourceRootLayout {
  /** Base dir passed to loadCatalog -- where catalog.json lives. */
  catalogRoot: string
  /** Base dir a CatalogRule.path is joined against to read the built artifact. */
  artifactBase: string
}

/**
 * A source root can be either a published layout (catalog.json + rules/ at
 * root -- what iuse ships to a downstream consumer) or a dev-repo checkout
 * staged under artifacts/ (Task 1's artifacts/ prefix migration). Detecting
 * this once lets list/show/assemble/browse stay agnostic of which shape they
 * were pointed at: `iuse --source ~/code/meta` works without the caller
 * having to know to add /artifacts.
 *
 * Editing-account lookups (profiles.json, globals.json, skills ledger, lock)
 * are NOT part of this -- those stay anchored at the raw source root
 * regardless of layout, since profiles.json/globals.json/meta/ are never
 * staged under artifacts/.
 */
export function detectSourceRoot(root: string): SourceRootLayout {
  if (existsSync(join(root, 'catalog.json'))) return { catalogRoot: root, artifactBase: root }
  if (existsSync(join(root, 'artifacts', 'catalog.json'))) {
    const artifacts = join(root, 'artifacts')
    return { catalogRoot: artifacts, artifactBase: artifacts }
  }
  // Neither shape found -- return root as-is so the existing "catalog.json
  // missing" structured error path (loadCatalog(root) -> null) fires
  // downstream with its established message, unchanged.
  return { catalogRoot: root, artifactBase: root }
}
