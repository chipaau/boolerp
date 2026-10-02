// The app packages this edition of the workspace ships (C102). Each is mounted at /<slug> from
// packages/app-<slug>/src/routes by the router config (vite.config.ts), and its manifest is
// listed in src/lib/apps.ts; src/edition.test.ts checks the two agree. An edition with fewer
// apps lists fewer here, and the others are not in its bundle.
export const appPackages = ['control-centre'] as const
