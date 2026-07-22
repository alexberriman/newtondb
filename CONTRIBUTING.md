# Contributing

NewtonDB changes are contract changes: start with the invariant, failure mode, or user outcome being improved. Public behavior needs runtime tests, type evidence where applicable, and documentation in the same change.

## Development

Use Node 24 and install without lifecycle scripts:

```sh
npm ci --ignore-scripts
npm run verify
```

Focused commands include `npm test`, `npm run typecheck`, `npm run api:check`, `npm run test:crash`, `npm run mutation:check`, `npm run security:check`, and `npm run test:package`. Update an API report deliberately with `npm run api:report`; unexplained report drift is a review blocker.

## Pull requests

- Keep commits narrow and explain the contract affected.
- Add regression, boundary, and failure-path tests—not only happy paths.
- Never weaken a durability, security, or transaction claim to make a test pass.
- Update examples and docs when behavior changes.
- Do not add runtime dependencies without a dependency, license, and threat review.
- Do not commit generated benchmark candidates or local planning files.

Storage, transaction, public API, and release changes require review from the corresponding ownership domain in `.github/CODEOWNERS`. Security-sensitive reports follow `SECURITY.md` rather than the public issue tracker.
