import { afterEach, beforeEach, describe, expect, it } from 'bun:test'

import { render, screen } from '@testing-library/react'

import { App } from '@/app'

// App 挂载即 fetch /api/assets；桩掉网络，测试不得依赖本机恰好在跑的 preview server
const originalFetch = globalThis.fetch

const stubFetch: typeof fetch = Object.assign(
  async () => new Response(JSON.stringify([]), { headers: { 'content-type': 'application/json' } }),
  { preconnect: () => undefined },
)

beforeEach(() => {
  globalThis.fetch = stubFetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('<App />', () => {
  it('renders the asset list shell and empty-selection state', async () => {
    render(<App />)
    expect(screen.getByText('infra-ai preview')).toBeDefined()
    expect(await screen.findByText('选择左侧资产')).toBeDefined()
  })
})
