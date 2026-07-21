# current release execution governance

## Decision log

| ID    | Decision                                                   | Status        | Evidence                  |
| ----- | ---------------------------------------------------------- | ------------- | ------------------------- |
| D-001 | Single ESM package; root plus `newtondb/node`              | accepted      | ADR-0001                  |
| D-002 | Node 22/24 LTS; TypeScript 6.0 strict NodeNext; track TS 7 | accepted      | ADR-0001                  |
| D-003 | Frozen detached outward JSON                               | accepted      | ADR-0002                  |
| D-004 | String/safe-integer immutable keys                         | accepted      | ADR-0002                  |
| D-005 | Fixed query v1 grammar, no regex/functions                 | accepted      | ADR-0002                  |
| D-006 | Serializable collection-granular optimistic transactions   | accepted      | ADR-0002                  |
| D-007 | Fenced exclusive writer; revision-ordered persistence      | accepted      | ADR-0003                  |
| D-008 | No legacy compatibility or migration surface               | accepted      | implementation plan scope |
| D-009 | Supported envelope set from early measured gates           | pending M1–M4 | ADR-0001                  |

## Risk register

| Risk                                                 | Probability | Impact | Mitigation and trigger                                                                                 | Owner       |
| ---------------------------------------------------- | ----------- | ------ | ------------------------------------------------------------------------------------------------------ | ----------- |
| Immutable snapshots amplify memory                   | medium      | high   | benchmark M1; change representation before API freeze if RSS gate fails                                | engine      |
| Collection-level conflicts reject useful concurrency | medium      | medium | history tests first; record-level design is after the initial release unless real workload blocks beta | transaction |
| File rename/sync differs by platform                 | high        | high   | qualify explicit OS/filesystem matrix; narrow support when any crash fixture fails                     | storage     |
| Query types cause slow TS inference                  | medium      | medium | large-schema type fixture and timing budget before beta                                                | API         |
| Package/toolchain advisories reappear                | high        | medium | lockfile audit, dependency review, expiring exception ledger                                           | release     |
| Scope grows beyond bounded JSON DB                   | medium      | high   | implementation plan scope table and ADR schedule-impact rule                                           | maintainer  |

## Severity and blockers

- P0: data loss/corruption, isolation or durability lie, exploitable unsafe input, published artifact mismatch.
- P1: public contract break before GA, unbounded resource path, unsupported scale claim, missing required recovery/packaging evidence.
- P2: documented limitation, ergonomics, optional performance improvement, deferred feature.

GA requires no open P0/P1. Waivers require an owner, reviewer, expiry, and user-visible disclosure and cannot waive corruption or false durability acknowledgement.

## Milestone issue template

Every milestone issue records: prerequisites; deliverable; relative size; owner; required reviewer domains; non-goals; acceptance commands and fixtures; evidence artifact; rollback/rework trigger; linked requirement and ADR IDs.
