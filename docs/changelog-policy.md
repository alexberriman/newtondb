# Changelog policy

`CHANGELOG.md` follows Keep a Changelog and semantic versioning. Every release entry names the exact package version and date and groups user-visible additions, changes, removals, fixes, security changes, and deprecations as applicable.

Public runtime/type exports, error codes and documented metadata, query grammar, snapshot format, package entry points, and durability semantics are versioned contracts. Internal planner details and diagnostic timing are not. A breaking contract change requires a major version; additive features require a minor version; compatible fixes require a patch. Prerelease suffixes may refine unreleased contracts but still require an explicit entry.

The release check fails when package, tag, source manifest, built manifest, and changelog version differ. Historical entries are not rewritten except to correct links or factual errors with an explicit note.
