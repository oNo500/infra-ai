import { join } from 'node:path'
import index from './index.html'
import { assetPayload, assetsPayload } from './src/api'

const REPO_ROOT = join(import.meta.dir, '..', '..')
const PORT = Number(Bun.env.PORT ?? 4412)

const server = Bun.serve({
  port: PORT,
  development: true,
  routes: {
    '/*': index,
    '/api/assets': () => Response.json(assetsPayload(REPO_ROOT)),
    '/api/asset/:name': (req) => {
      const payload = assetPayload(REPO_ROOT, req.params.name)
      return payload ? Response.json(payload) : new Response('not found', { status: 404 })
    },
  },
})

console.log(`preview at http://localhost:${server.port}`)
