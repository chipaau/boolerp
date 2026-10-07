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
      // API access goes through the BFF and through @workspace/api only (C175, C184). A raw fetch
      // skips the one error policy, the request id, the abort handling and the 401 sign-in — the
      // things that make every call behave the same. The hand-written apps/admin/src/lib/api.ts was
      // exactly that second client, and it is gone (F2f).
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'Call the API through @workspace/api, never fetch directly (C175).' },
      ],
      // `api` is the raw request function: it belongs in one file per feature, so a feature's calls,
      // keys and schemas stay in one readable place instead of spreading through components (C184).
      // Everything else @workspace/api exports (ApiError, listOf, createKeys, createQueryClient…) is
      // free to import anywhere.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@workspace/api',
              importNames: ['api'],
              message: 'Import `api` only in features/<feature>/api.ts; call that feature’s queries instead (C184).',
            },
          ],
        },
      ],
    },
  },
  {
    // the one place a feature's API calls live
    files: ['src/features/*/api.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    ignores: ['eslint.config.js', 'prettier.config.js'],
  },
]
