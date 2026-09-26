# Working agreement

## Scope and authorization

- Decide one architecture question at a time. Give a recommendation and its trade-off;
  do not present an unresolved recommendation as a confirmed decision.
- Distinguish discussion, documentation work, and application implementation.
  Authorization to update documentation or create a branch does not authorize scaffolding.
- Continue work already authorized without repeatedly asking for the same permission.
- Confirm data models table by table before implementing tables, migrations, or queries
  against them. Record explicit approval once; do not infer it from illustrative examples.
- Be critical, explain practical trade-offs, and verify claims when evidence is needed.
- Do not change unrelated files, remove existing data, or repair the previous API
  merely to keep it running during the rebuild.

## Documentation

- All project documentation belongs under `docs/`.
- All substantive agent rules belong under `.claude/`.
  `AGENTS.md` and `CLAUDE.md` are navigation entry points only.
- Start with [docs/README.md](../../docs/README.md). Record current decisions in the
  [decision register](../../docs/decisions/README.md); keep component documents consistent.
- Historical documents under `docs/archive/` are not instructions or an implementation
  baseline, even when they contain labels such as Accepted, Confirmed, or Implemented.
- Preserve historical material and pre-existing untracked work when reorganizing it.
- Update relevant documentation with behavior changes. Never mark a feature implemented
  solely because its specification or directory structure exists.

## Branches and commits

- Create branches when requested. Keep unrelated work out of commits.
- Do not commit, push, or open a pull request without authorization for that action.
- Do not add AI attribution to commit messages.

## Implementation style

- Use explicit dependency construction and ordinary Go packages.
- Keep business rules independent of transport, database drivers, and providers.
- Do not add a generic repository framework or speculative interfaces.
- Preserve tenant and caller context across every entry point.
- Run language builds and application tests through Docker; do not assume matching
  host Go, Node, or pnpm versions.
