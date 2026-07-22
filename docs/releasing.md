# Release runbook

## Roles and authority

The release owner prepares the candidate; an independent storage/security or API reviewer approves the evidence. The protected `npm` GitHub environment requires two-person approval for stable publication. npm trusted publishing uses GitHub OIDC—no long-lived publish token. At least two maintainers must retain recoverable npm and GitHub ownership; access is reviewed quarterly and recovery is rehearsed annually without changing production state.

Severity follows `docs/project/governance.md`. No open P0/P1 blocker may be waived for stable release. Security embargoes use private advisories and named need-to-know reviewers.

## Candidate preparation

1. Update `package.json`, `CHANGELOG.md`, and `release/source-manifest.json` to the same version.
2. Run `npm ci --ignore-scripts` from a clean checkout on Node 22.13 and Node 24.
3. Run `npm run verify`, `npm run mutation:check`, `npm run benchmark:qualify`, `npm run docs:check`, `npm run logo:check`, and `npm run test:package`.
4. Generate API reports and reject unexplained public-surface drift.
5. Review dependency audit, license output, SBOM, threat-model disposition, crash evidence, supported-scale report, and open issues labeled `release-blocker`, `security`, `storage`, `api`, or `adapter-feedback`.
6. Run the checklist twice from separate clean directories. Record command output, commit, Node/OS/filesystem, reviewer, and disposition in the release evidence artifact.

The release candidate soak is at least seven days. It covers memory and file examples, 1k/10k/100k fixtures, supported Node lines, the qualified Linux local filesystem, custom-adapter conformance, deliberate corruption/recovery, and a fresh consumer install. Ambiguity becomes an ADR/test/doc change or an explicit non-goal before approval.

Collect public findings through the release-candidate feedback issue form. Triage each report into `api`, `adapter-feedback`, `storage`, `security`, or `release-blocker`; link its reproducer and final test/doc/ADR evidence in the disposition log. Close a report only when its disposition is independently reviewable. Security reports always use the private advisory link instead.

## Build once and publish

Create one tarball with `npm pack --json`, record SHA-256, generate CycloneDX SBOM and provenance, and attach all three to the protected run. Publish that exact filename—never rebuild between review and publication. The tag must be `v<package version>`, point to a commit contained in protected `main`, and pass `release:check`.

After publication, download the registry tarball, compare its SHA-256 and contents with the reviewed tarball, install it in a fresh consumer, run runtime/type/import/restart/recovery examples, and record the registry integrity. Move `latest` only after verification; prereleases use the appropriate dist-tag.

## Release rollback

npm versions are immutable. For a bad package, remove it from active dist-tags when policy permits, point consumers to the last verified release, publish a forward fix, and issue an advisory. Do not silently rebuild or reuse a version.

Data rollback is separate: stop writers, preserve evidence, restore the exact verified backup paired with the compatible application/schema, open/query/close/reopen in isolation, then switch paths atomically. Never assume an older package can read a newer storage format.

## Recovery of maintainer access

Quarterly, verify two owners, hardware-backed MFA, recovery codes in the approved secret store, GitHub environment reviewers, npm trusted-publisher binding, branch/tag protection, and security-advisory access. The annual drill uses a sandbox organization/package or read-only walkthrough; its date, participants, gaps, and remediation owner are recorded privately. Compromised credentials trigger immediate revocation, provenance/digest review, npm/GitHub support escalation, and public advisory when artifact integrity may be affected.
