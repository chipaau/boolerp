//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'

export default [
  ...tanstackConfig,
  {
    rules: {
      'import/no-cycle': 'off',
      'import/order': 'off',
      'sort-imports': 'off',
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/require-await': 'off',
      'pnpm/json-enforce-catalog': 'off',
      // Fixtures (features/*/mock.ts) are reachable only through that feature's queries.ts, so
      // every screen already reads data the way it will against the real API, and deleting the
      // mock files at integration cannot break a component.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/mock', '**/mock.ts', './mock', '../*/mock', '@/features/*/mock', '#/features/*/mock'],
              message: 'Read fixtures through the feature’s queries.ts hooks, never directly.',
            },
          ],
        },
      ],
    },
  },
  {
    // the only legitimate importers of fixtures
    files: ['src/features/*/queries.ts', 'src/proto/**'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    ignores: ['eslint.config.js', 'prettier.config.js'],
  },
]
