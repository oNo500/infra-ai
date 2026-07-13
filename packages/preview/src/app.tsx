import { useEffect, useState } from 'react'
import { AssetList } from '@/components/asset-list'
import { AssetView } from '@/components/asset-view'
import type { AssetSummary } from '@/api'

function hashName(): string | null {
  const raw = window.location.hash.replace(/^#/u, '')
  return raw === '' ? null : decodeURIComponent(raw)
}

export function App() {
  const [assets, setAssets] = useState<AssetSummary[]>([])
  const [selected, setSelected] = useState<string | null>(hashName())

  useEffect(() => {
    void fetch('/api/assets').then(async (res) => {
      const list = (await res.json()) as AssetSummary[]
      setAssets(list)
      setSelected((current) => current ?? list[0]?.name ?? null)
    })
  }, [])

  useEffect(() => {
    const onHash = () => setSelected(hashName())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  return (
    <div className="flex h-screen bg-background text-foreground">
      <aside className="w-64 shrink-0 overflow-y-auto border-r">
        <div className="px-4 py-3 font-mono text-sm font-semibold">infra-ai preview</div>
        <AssetList
          assets={assets}
          selected={selected}
          onSelect={(name) => {
            window.location.hash = encodeURIComponent(name)
          }}
        />
      </aside>
      <main className="min-w-0 flex-1">
        {selected === null ? (
          <div className="p-8 text-sm text-muted-foreground">选择左侧资产</div>
        ) : (
          <AssetView name={selected} />
        )}
      </main>
    </div>
  )
}
