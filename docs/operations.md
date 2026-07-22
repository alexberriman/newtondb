# Maintainer operations

## Review domains

`CODEOWNERS` routes engine/transaction, storage, input/query security, workflows, and security policy to the maintainer. Until the project has additional maintainers, stable publication still requires an independent named reviewer through the protected environment; self-approval is not sufficient.

## Vulnerability response

Private reports are acknowledged within three business days. Triage records affected releases, exploitability, confidentiality/integrity/availability impact, severity, owner, embargo participants, fix/backport decision, regression test, advisory, and publication plan. Critical active exploitation triggers immediate credential/artifact review and the shortest safe coordinated release.

## Dependency cadence

Dependabot checks npm and GitHub Actions weekly. CI rejects new high/critical advisories, unapproved licenses, and dependency-review findings. Any temporary exception records advisory/path, runtime or development reachability, exploitability, mitigation, owner, approver, and expiry; new, worsened, or expired exceptions fail release. Runtime dependencies require exceptional justification—the current package has none.

## Issue severity

- P0: corruption/data loss, isolation or durability lie, exploitable hostile input, registry artifact mismatch.
- P1: public contract break before stable release, unbounded supported input, false scale claim, missing recovery/package evidence.
- P2: bounded bug with workaround, documentation defect, or optional performance improvement.

Stable release requires no open P0/P1. The authoritative review searches open issues and private advisories by the labels defined in the release runbook and records a signed disposition in release evidence.

## Backports

Only the latest stable major is routinely supported. Security or corruption fixes may be backported when upgrading is infeasible and the patch can preserve that line's format/API. Every backport gets the same tests and release evidence as a normal patch. Unsupported prototype releases receive no fixes.
