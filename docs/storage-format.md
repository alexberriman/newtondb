# Snapshot format

The storage envelope format is independent from the npm package version. The current constants are:

- `format: 'newtondb'`
- `formatVersion: 1`
- minimum readable version: `1`
- maximum readable version: `1`

The envelope contains database identity, generation, revision, canonical catalog, and collection records. The Node file wraps it with a SHA-256 checksum. Indexes are rebuilt from records and are not persisted as authority.

Unknown top-level envelope fields are ignored for additive forward metadata. Required fields, catalog entries, collection containers, paths, generations, revisions, JSON shape, and checksums are validated. Duplicate JSON object names are rejected before `JSON.parse`. Unknown or older/newer format versions fail closed; there is no implicit upgrade or downgrade.

Any future format change requires fixtures for the previous, current, and next version; explicit minimum/maximum reader constants; idempotent ordered transforms; checksum verification before conversion; interrupted-upgrade recovery; and downgrade refusal. A package release must never move the format version merely to match semver.

The package intentionally has no historical-format importer or compatibility shim. Generic application-controlled export/import can be built against public collection APIs when needed.
