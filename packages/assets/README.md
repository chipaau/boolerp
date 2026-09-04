# @workspace/assets

Static artwork shared by every workspace app. Import by path, e.g.
`import taskArt from "@workspace/assets/logos/task.png"`.

`logos/`
- `<app>.png` — the large illustrated icon for an app tile (Home honeycomb).
- `<app>-glyph.png` — the small single-colour glyph for that app (sidebar header, inbox rows, app switcher).
- `hexa-logo.png` — the brand mark as exported from the design.

Keep files kebab-case and named by app slug (see `apps/app/src/lib/apps.ts`) so `AppIcon` picks them up.
