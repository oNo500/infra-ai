import { describe, expect, it } from 'bun:test'

import { render, screen } from '@testing-library/react'

import { App } from '@/app'

describe('<App />', () => {
  it('renders the asset list shell and empty-selection state', async () => {
    render(<App />)
    expect(screen.getByText('infra-ai preview')).toBeDefined()
    expect(await screen.findByText('选择左侧资产')).toBeDefined()
  })
})
