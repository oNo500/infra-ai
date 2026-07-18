import { afterAll } from 'bun:test'

import { GlobalRegistrator } from '@happy-dom/global-registrator'

GlobalRegistrator.register({ url: 'http://localhost:4412' })

afterAll(async () => {
  // 让 React scheduler 排队的回调先落地，再摘掉全局 window
  await new Promise((resolve) => setTimeout(resolve, 0))
  GlobalRegistrator.unregister()
})
