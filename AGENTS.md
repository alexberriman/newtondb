# NewtonDB Engineering Guide

This repository is being rebuilt as NewtonDB. These instructions apply to the entire repository.

## Mission

Implement the complete specification in `PLANV2.md` as a clean, breaking redesign. The legacy implementation is audit evidence only: do not preserve its runtime API, deep imports, storage format, adapters, or accidental semantics.

## Source of truth

- `PLANV2.md` is the implementation and verification checklist.
- Update its checkboxes only when current repository evidence proves the item is complete.
- Never stage or commit `PLANV2.md`. It is a local progress ledger.
- Binding architecture decisions belong in committed ADRs under `docs/decisions/`.
- Public contracts belong in committed manifests and executable contract tests.

## Architecture constraints

- Keep a single ESM package unless an approved ADR changes that decision.
- Support maintained Node.js LTS releases declared in `package.json` and the support policy.
- Keep the engine platform-neutral. Node filesystem code must live behind the documented Node subpath.
- Stored documents are bounded plain JSON objects. Validate inputs before they enter engine ownership.
- Outward data must be detached or recursively frozen at runtime; TypeScript readonly types are not sufficient.
- Primary keys are immutable, unique, non-empty strings or safe integers.
- Use token-array paths, own-property access, `Map`, or null-prototype dictionaries. Never traverse inherited prototypes.
- Transactions publish atomically under the documented isolation model. Failures must never expose partial state.
- Persistence is revision-ordered and uses fenced exclusive ownership or conditional generation writes.
- Do not claim durability, compatibility, security, scale, or performance beyond tested and documented evidence.

## Implementation discipline

- Prefer the simplest design that satisfies the complete contract and measured supported envelope.
- Keep public API orchestration thin; schema, query, engine, transaction, events, and storage boundaries must remain explicit.
- Do not expose internal records, mutable indexes, transaction roots, or unversioned planner details.
- Do not add legacy facades, migration tooling, codemods, deep-export aliases, or compatibility documentation.
- Avoid adding dependencies when the platform or a small reviewed implementation is sufficient.
- Every public symbol, error code, event, wire format, package subpath, and CLI behavior must be registered and tested.
- Treat validators, predicates, observers, and adapters as extension boundaries. Normalize their failures and document trust/resource limitations.

## Testing requirements

- Add unit tests with every behavior change.
- Add contract, type, integration, model/state-machine, differential, fault-injection, crash/recovery, package-consumer, and benchmark tests where required by `PLANV2.md`.
- Test failures and hostile inputs, not only happy paths.
- Persist minimized failing property-test seeds as regression fixtures.
- Verification must run against the packed artifact before release.
- Coverage percentages are informational; named invariants and semantic partitions are release gates.

## Security and durability

- Reject unsupported JSON values, accessors, non-plain prototypes, cycles, excessive depth/size, invalid queries, and immutable-key changes before publication.
- Prevent prototype pollution without unnecessarily banning safe JSON property names.
- Serializable queries use only the fixed, validated, bounded operator set. No arbitrary preprocessors or unsafe regex execution.
- A persisted acknowledgement must identify the database, generation, and revision it covers.
- A persistence failure after memory publication must carry the committed receipt; it does not imply rollback.
- File persistence and recovery guarantees apply only to explicitly supported and tested platform/filesystem combinations.

## Commits and worktree safety

- Make focused, reviewable commits after each independently verified milestone or coherent slice.
- Run the relevant test, typecheck, lint, package, security, or benchmark gates before committing.
- Stage explicit paths. Never use broad staging that could include `PLANV2.md` or unrelated user work.
- Before every commit, inspect `git diff --cached --stat` and `git status --short`.
- Use Conventional Commit subjects.
- Never rewrite, discard, or overwrite user changes.

## Documentation and visual identity

- Documentation must describe only behavior present in the exact released artifact.
- Keep examples executable in CI.
- Rewrite `README.md` only after the public API and release guarantees are stable.
- The Newton logo is a repository-native SVG asset. Evaluate it through five recorded passes: structural validity/accessibility, rendering, small-size legibility, monochrome/dark-light behavior, and originality/brand fit.

## Definition of done

Do not call the release complete until every applicable `PLANV2.md` item and release gate has authoritative evidence, the plan audit finds no missing or weakly supported requirement, all verification passes from a clean checkout and packed artifact, the final README and logo are complete, and `PLANV2.md` remains uncommitted.
