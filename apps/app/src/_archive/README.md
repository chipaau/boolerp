# Archived UI (not built, not routed)

Nothing in this folder is imported by the app. It is kept so the pieces can be restored with a
small, mechanical change instead of being dug out of git history.

| File | What it was | How to restore |
|---|---|---|
| `archived-apps.ts` | `AppDef`s for **Staff Hub** (the old default landing app), **Calendar** and **Finance** | Copy the entry into `APPS` in `src/lib/apps.ts`. Their sections render via `src/proto` like every other prototype page. |
| `app-themes.css` | Per-app accent colours (`.theme-<slug>` blocks that override the primary tokens) | Import from `src/styles.css` after `@workspace/ui/globals.css`, and add the class to `<html>` (see `use-app-theme.ts`). Replaced by the single brand theme in `packages/ui`. |
| `use-app-theme.ts` | Hook that set `.theme-<slug>` on `<html>` for the active app | Call `useAppTheme(app)` in `src/routes/_app/$app.tsx`. |

The `@source "../"` directive in `src/styles.css` still scans this folder for Tailwind classes; that is
harmless (a few unused utilities) and keeps restoring a file a one-line change.
