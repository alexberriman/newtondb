# ADR-0001: Product and platform contract

- Status: accepted
- Date: 2026-07-22
- Owners: maintainer
- Review domains: API, engine, storage, release

## Context

The legacy NewtonDB implementation combines a useful fluent JSON API with unsafe ownership, non-atomic mutation, racing persistence, accidental exports, and unimplemented product claims. The replacement intentionally breaks compatibility rather than carrying those constraints forward.

## Decision

NewtonDB is a single ESM npm package for bounded, in-memory JSON document collections with optional crash-safe Node file persistence.

- Package: `newtondb`; root export is the platform-neutral API; `newtondb/node` exports Node storage.
- Runtime support: maintained Node 22 and 24 LTS lines. Node 26 is tested after it reaches LTS; Current releases are advisory.
- TypeScript support: TypeScript 6.0.x, the newest line supported by the lint/type tooling at project initialization; strict mode, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, and NodeNext resolution. TypeScript 7 is tracked for adoption once the toolchain supports it. Declarations must also work for JavaScript consumers.
- Browser support, CJS, V1 compatibility, V1 migration, SQL, joins, replication, caching, arbitrary query functions, ordered indexes, and cursor pagination are not the initial release scope.
- Workload: a single process owns a database; data and indexes fit in memory. The supported byte/record envelope is fixed from controlled M1–M4 measurements before beta.
- Delivery: one package and one repository. Internal modules are explicit but are not separately published.

## Public walking skeleton

The minimum public contract is:

```ts
const memory = Database.memory({ users }, { schema });
const file = await Database.open({ adapter, schema });

memory.collection("users").get("u1"); // ReadonlyDeep<User> | undefined

await memory.transaction((tx) => {
  tx.collection("users").update("u1", { active: false });
});

const unsubscribe = memory.subscribe((batch) => {});
await file.flush();
await file.close();
unsubscribe();
```

The memory constructor is synchronous. Transactions always return promises so the same control flow works with durability and future cooperative scheduling. `Database.open`, durable commit, `flush`, and `close` are asynchronous. Queries over a committed in-memory snapshot are synchronous in the initial release.

## Supported scale decision process

The release will publish measured limits rather than aspirational record counts. Candidate fixtures are 1k, 10k, 100k, and increasing byte-sized corpora until one of the following is breached:

- peak RSS exceeds 4× canonical snapshot bytes;
- p95 full snapshot flush exceeds the approved beta budget;
- a one-record update shows collection-size allocation;
- event retention prevents bounded memory;
- load validation cannot reject oversize input before unsafe allocation.

The largest fixture with margin on every supported Node/platform becomes the published envelope.

## Consequences

The smaller platform and API surface make runtime immutability, transaction semantics, artifact verification, and file durability testable. Existing consumers must treat this as a new library contract.
