//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'

export default [
  { ignores: ['.next/**', 'next-env.d.ts', 'eslint.config.js', 'postcss.config.mjs', 'prettier.config.js'] },
  ...tanstackConfig,
  {
    rules: {
      'import/no-cycle': 'off',
      'import/order': 'off',
      'sort-imports': 'off',
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/require-await': 'off',
      'pnpm/json-enforce-catalog': 'off',
      // The demo (lib/demo: fixtures, the stand-in booking rules, browser storage) is reachable only
      // through @/lib/data, so every screen already reads data the way it will against FindCare's
      // API, and deleting lib/demo at integration cannot break a component. Same rule as the
      // workspace's mock.ts files.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/lib/demo', '@/lib/demo/*', '**/lib/demo/*'],
              message: 'Read and act through @/lib/data, never the demo directly.',
            },
          ],
        },
      ],
    },
  },
  {
    // the seam itself, and the demo's own modules
    files: ['lib/data/**', 'lib/demo/**'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    // within the demo, only the store may read the fixtures
    files: ['lib/demo/**'],
    ignores: ['lib/demo/store.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{ group: ['./mock'], message: 'Only ./store.ts reads the fixtures.' }] }],
    },
  },
]
