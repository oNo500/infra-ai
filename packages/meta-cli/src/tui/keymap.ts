export interface KeymapEntry {
  actionId: string
  view: 'assets' | 'targets' | 'detail' | 'skills'
  key?: string
}

// key 缺省表示该 query 动作由视图本身承载。
// 子视图组件内的按键绑定必须与本表一致（parity 测试保证动作覆盖，不校验绑定本身）。
export const KEYMAP: KeymapEntry[] = [
  { actionId: 'status', view: 'assets' },
  { actionId: 'adopt', view: 'assets', key: 'a' },
  { actionId: 'build', view: 'assets', key: 'b' },
  { actionId: 'writeback', view: 'assets', key: 'w' },
  { actionId: 'dist', view: 'assets', key: 'd' },
  { actionId: 'targets:list', view: 'targets' },
  { actionId: 'targets:add', view: 'targets', key: 'n' },
  { actionId: 'targets:remove', view: 'targets', key: 'x' },
  { actionId: 'targets:subscribe', view: 'targets', key: 'space' },
  { actionId: 'targets:unsubscribe', view: 'targets', key: 'space' },
  { actionId: 'skills:status', view: 'skills' },
  { actionId: 'skills:fix', view: 'skills', key: 'f' },
  { actionId: 'skills:update', view: 'skills', key: 'u' },
]
