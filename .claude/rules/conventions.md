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
- Prefer established, maintained frameworks, libraries, and SDKs that fit the
  confirmed architecture and use case. Do not build in-house substitutes for
  capabilities a suitable ecosystem tool already provides.
- Before writing any feature, check whether the selected framework or tool
  already provides it (for HTTP: chi, `chi/middleware`, and go-chi packages such
  as `cors` and `httplog`; otherwise the Go standard library). Use the provided
  feature. Write custom code only for a verified gap, and record that gap and why
  the framework feature is insufficient in the component document. If the
  framework's behavior differs from a recorded contract, raise the difference
  with the user instead of reimplementing it.
- When a choice would change an architectural boundary, external provider,
  dependency, operational contract, or user-visible behavior, explain the concrete
  need, recommend an option with trade-offs, and ask the user before deciding or
  implementing it. Record the user's decision in the decision register and an
  ADR when it affects architecture. Do not turn a recommendation into a decision.
- Suggest established patterns when they solve a concrete problem; explain the
  benefit and cost, and leave the choice open until the user confirms it. Routine
  implementation details inside a confirmed decision do not require repeated approval.
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
