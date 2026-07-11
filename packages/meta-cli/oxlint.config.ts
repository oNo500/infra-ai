import { base, depend, node, unicorn } from '@infra-x/code-quality/lint'
import { defineConfig } from 'oxlint'

export default defineConfig({
  extends: [base(), unicorn(), depend(), node()],
  overrides: [
    {
      // plan-mandated src/core + src/tui + tests layout requires ../ imports
      // across those directories; there is no package boundary to preserve.
      // Scoped as an override (not top-level rules) because base()'s own
      // GLOB_SRC override sets this rule and would otherwise win.
      files: ['**/*.{ts,tsx}'],
      rules: {
        'import/no-relative-parent-imports': 'off',
      },
    },
    {
      // Test helper closures (e.g. mock `run` functions) are intentionally
      // declared inline per-test for readability even when they capture
      // nothing; hoisting them adds indirection without benefit.
      files: ['tests/**'],
      rules: {
        'unicorn/consistent-function-scoping': 'off',
      },
    },
  ],
})
