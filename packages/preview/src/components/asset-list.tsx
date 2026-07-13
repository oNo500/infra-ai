import { Badge } from '@/components/ui/badge'
import type { AssetSummary } from '@/api'

const STATUS_CLASS: Record<string, string> = {
  synced: 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-300',
  stale: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  dirty: 'bg-red-600/15 text-red-700 dark:text-red-300',
  unbuilt: 'bg-cyan-600/15 text-cyan-700 dark:text-cyan-300',
  untracked: 'bg-fuchsia-600/15 text-fuchsia-700 dark:text-fuchsia-300',
  stub: 'bg-muted text-muted-foreground',
}

export function AssetList({
  assets,
  selected,
  onSelect,
}: {
  assets: AssetSummary[]
  selected: string | null
  onSelect: (name: string) => void
}) {
  return (
    <nav className="px-2 pb-4 flex flex-col gap-0.5">
      {assets.map((asset) => (
        <button
          key={asset.name}
          type="button"
          onClick={() => onSelect(asset.name)}
          className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left font-mono text-sm ${
            asset.name === selected ? 'bg-accent' : 'hover:bg-accent/50'
          }`}
        >
          <span className="truncate">{asset.name}</span>
          <span className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">{asset.kind}</span>
            <Badge variant="outline" className={STATUS_CLASS[asset.status] ?? ''}>
              {asset.status}
            </Badge>
          </span>
        </button>
      ))}
    </nav>
  )
}
