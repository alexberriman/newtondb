# Security policy

## Reporting a vulnerability

Please use GitHub's private **Report a vulnerability** flow for this repository. Do not open a public issue for a suspected vulnerability. Include the affected version, minimal reproduction, impact, and any suggested mitigation. The maintainer will acknowledge a complete report within three business days, assign severity, coordinate an embargo when warranted, and publish an advisory and patched release after remediation.

Do not include production records, credentials, database files, or private filesystem paths in a report. Synthetic fixtures are preferred.

## Supported releases

| Release line                       | Security fixes           |
| ---------------------------------- | ------------------------ |
| Latest `2.x` stable                | Supported                |
| Current `2.x` prerelease           | Supported during testing |
| Older major and prototype releases | Unsupported              |

Critical fixes target the latest stable line first. Backports are considered only when a supported line cannot safely upgrade. The policy is reviewed for every stable release.

## Security boundaries

NewtonDB validates bounded plain JSON data and serializable query ASTs. JavaScript proxies, schema validators, local predicates, listeners, and custom adapters execute application code and are trusted. The Node file adapter assumes a private directory and cooperative writers; its checksum detects accidental corruption, not malicious tampering or rollback. Full before/after event documents are disabled by default and should be treated as sensitive when enabled.

See [the threat model](docs/security.md) for assets, actors, limits, filesystem assumptions, and denial-of-service boundaries.
