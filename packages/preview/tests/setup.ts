import { afterAll } from 'bun:test'

import { GlobalRegistrator } from '@happy-dom/global-registrator'

GlobalRegistrator.register({ url: 'http://localhost:4412' })

afterAll(() => GlobalRegistrator.unregister())
