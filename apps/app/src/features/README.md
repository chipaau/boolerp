# Features

One folder per feature (business module or shell surface). Screens read data **only** through the
feature's hooks, so a screen never knows whether it is looking at a fixture or the API.

| File | Role | Fate at integration |
|---|---|---|
| `types.ts` | Resource shapes, mirroring the API | Becomes re-exports of the generated `@workspace/api-client` types |
| `logic.ts` | Pure derivations and presentation maps (filters, tones, totals) | Stays |
| `queries.ts` | TanStack Query options + hooks — **the seam** | Stays; only the `queryFn`s change (fixture → client call) |
| `mock.ts` | Fixtures. Importable only from `queries.ts` (lint rule in `eslint.config.js`) | **Deleted** |
| `*-page.tsx`, components | UI, reading via hooks | Stays untouched |

Screens use `useSuspenseQuery` (the route has `wrapInSuspense`), so a page renders with data or
not at all; state changes that swap a query key run in `startTransition` so the current view stays
up while the next loads. Shell chrome (`shell/`: nav counts, notifications) uses plain `useQuery`
and renders immediately, filling counts in as they arrive.

Removing every fake from the app is two deletions and a lint run:

```bash
find apps/app/src/features -name mock.ts -delete && rm -r apps/app/src/proto
```

`screens.ts` maps app/section slugs to real screens; anything unmapped falls back to the
prototype page in `src/proto` until it is built.
