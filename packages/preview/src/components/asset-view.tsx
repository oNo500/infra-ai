import { useEffect, useState } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { parseDoc } from '@/lib/markdown'
import type { AssetDetail } from '@/api'

function Doc({ path, content, missing }: { path: string; content: string | null; missing: string }) {
  if (content === null) {
    return <div className="p-6 text-sm text-muted-foreground">{missing}</div>
  }
  const { frontmatter, html } = parseDoc(content)
  return (
    <ScrollArea className="h-full">
      <div className="p-6">
        <div className="mb-3 font-mono text-xs text-muted-foreground">{path}</div>
        {frontmatter !== null && (
          <pre className="mb-4 overflow-x-auto rounded bg-muted p-3 font-mono text-xs">{frontmatter}</pre>
        )}
        <article className="md" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </ScrollArea>
  )
}

export function AssetView({ name }: { name: string }) {
  const [detail, setDetail] = useState<AssetDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setDetail(null)
    setError(null)
    void fetch(`/api/asset/${encodeURIComponent(name)}`).then(async (res) => {
      if (!res.ok) {
        setError(`加载失败：${res.status}`)
        return
      }
      setDetail((await res.json()) as AssetDetail)
    })
  }, [name])

  if (error !== null) return <div className="p-8 text-sm text-red-600">{error}</div>
  if (detail === null) return <div className="p-8 text-sm text-muted-foreground">加载中…</div>

  const metaDoc = <Doc path={detail.metaPath} content={detail.meta} missing="" />
  const artifactDoc = <Doc path={detail.artifactPath} content={detail.artifact} missing="产物尚未构建" />

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b px-6 py-3">
        <span className="font-mono font-semibold">{detail.name}</span>
        <span className="text-xs text-muted-foreground">
          {detail.kind} · {detail.status}
        </span>
      </header>
      <div className="hidden min-h-0 flex-1 lg:flex">
        <div className="min-w-0 flex-1">{metaDoc}</div>
        <Separator orientation="vertical" />
        <div className="min-w-0 flex-1">{artifactDoc}</div>
      </div>
      <Tabs defaultValue="artifact" className="flex min-h-0 flex-1 flex-col lg:hidden">
        <TabsList className="mx-6 mt-3">
          <TabsTrigger value="meta">元指令</TabsTrigger>
          <TabsTrigger value="artifact">产物</TabsTrigger>
        </TabsList>
        <TabsContent value="meta" className="min-h-0 flex-1">
          {metaDoc}
        </TabsContent>
        <TabsContent value="artifact" className="min-h-0 flex-1">
          {artifactDoc}
        </TabsContent>
      </Tabs>
    </div>
  )
}
