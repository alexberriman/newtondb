# ADR-0002: Data, query, and transaction semantics

- Status: accepted
- Date: 2026-07-22
- Owners: maintainer
- Review domains: schema, security, query, transaction

## JSON ownership

Documents are bounded plain JSON objects. The engine rejects cycles, sparse arrays, accessors, non-plain prototypes, `undefined`, functions, symbols, bigint, and non-finite numbers before publication. Input is detached into engine ownership. Every outward value is a recursively frozen detached value; no outward alias can mutate current or historical engine roots.

Paths are token arrays internally. Traversal uses own properties only. Internal user-keyed stores use `Map` or null-prototype records. JSON keys such as `__proto__` remain valid data and never select a prototype.

Validators are synchronous and validation-only. They cannot transform/default values or re-enter the database. Thrown validator errors are normalized.

## Keys and ordering

- A collection has an immutable unique primary key: a non-empty string or safe integer.
- Generated keys, when enabled, are cryptographically random UUID strings. Generation happens inside the transaction; rollback discards them.
- Canonical encoding uses separate tagged namespaces for strings and safe integers and preserves JavaScript string code units without normalization.
- Insertion order is stable for un-ordered scans. Explicit sorting uses documented type/missing/collation rules and a primary-key tie-breaker.
- V2.0 secondary indexes are declared hash indexes only, unique or non-unique.

## Query grammar

Serializable query version `1` contains fixed comparison and boolean nodes:

- comparison: `eq`, `ne`, `lt`, `lte`, `gt`, `gte`, `in`, `contains`, `startsWith`, `endsWith`;
- boolean: `and`, `or`, `not`;
- property paths are arrays of string/array-index tokens;
- local predicates are a separately branded trusted API and are not serializable;
- regex and arbitrary preprocessors/functions are excluded.

Missing is distinct from `null`. Ordering comparisons require same-domain string or finite number operands. Invalid/mixed operands fail query validation rather than coercing. Query/node/path/result/candidate limits are checked before and during engine-controlled loops.

## Transactions

V2.0 uses serializable optimistic transactions with collection-granular conflict validation:

- a transaction captures database and per-collection base revisions;
- point and predicate reads mark their collection read;
- writes mark their collection written;
- commit conflicts if any read or written collection revision changed after the base revision;
- this prevents write skew and phantoms at collection granularity;
- all schema, uniqueness, index, and resource checks complete before a single root publication;
- cross-collection publication is atomic;
- callbacks are synchronous: returning a promise is rejected. The outer API remains async;
- callbacks are never implicitly retried;
- transaction age, read collections, write operations, and result sizes are bounded;
- nested/repeated/reentrant commit is rejected with a stable error code.

The transaction state machine is `active -> committed | rolledBack`. Listener execution occurs after publication and cannot change the commit result.
