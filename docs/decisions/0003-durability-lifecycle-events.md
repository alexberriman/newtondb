# ADR-0003: Durability, lifecycle, and events

- Status: accepted
- Date: 2026-07-22
- Owners: maintainer
- Review domains: storage, operations, events, security

## Storage ownership

A writable persistent adapter must either hold an exclusive fenced writer lease acquired before load and retained through close, or implement atomic conditional store by expected generation. The V2 Node file adapter uses an exclusive lock and generation metadata. Other processes that ignore the protocol are outside the guarantee; detection is best effort.

## Revisions and acknowledgements

- In-memory publication assigns a monotonically increasing database revision.
- `commit()` resolves after publication and returns an immutable receipt.
- persisted durability resolves only after a crash-recoverable installed snapshot contains a revision greater than or equal to the receipt revision.
- `flush()` captures the committed target revision at invocation and waits for durable revision `>= target` for the same database identity/generation.
- physical snapshots may coalesce, but acknowledgements cannot reorder, strand, or lie.
- persistence failure never rolls back the published transaction. `PersistenceError` carries its committed receipt.
- queue size and retries are bounded; after persistence failure the database becomes `degraded` and rejects durable commits until explicitly recovered or closed.

## Lifecycle

States are `opening`, `open`, `degraded`, `closing`, `closed`, and `corrupt`.

| Operation      | opening            | open            | degraded                                 | closing                   | closed/corrupt                                  |
| -------------- | ------------------ | --------------- | ---------------------------------------- | ------------------------- | ----------------------------------------------- |
| read/query     | reject/not exposed | allow           | allow last committed root                | reject                    | reject                                          |
| memory commit  | reject/not exposed | allow           | allow only with explicit volatile option | reject                    | reject                                          |
| durable commit | reject/not exposed | allow           | reject                                   | reject                    | reject                                          |
| flush          | reject/not exposed | allow           | reject with cause                        | join captured close/flush | reject                                          |
| close          | join open          | transition once | transition once                          | join existing promise     | idempotent closed result / corrupt cleanup only |

Reload is not a V2.0 operation. Abort signals are observed only at cooperative engine/adapter checkpoints. Arbitrary synchronous callbacks cannot be preempted.

## Events

One immutable batch is scheduled for each published transaction. It includes database identity, transaction ID, revision, ordered `insert | update | delete` changes, and frozen before/after values according to projection. Delivery is at-most-once in memory, after commit publication, in revision/subscription order.

- subscription returns an idempotent `unsubscribe` function;
- listener errors are isolated and reported to the configured error hook;
- removal during dispatch affects later batches, not the current subscriber snapshot;
- reentrant transactions are queued after the current batch;
- event queue and payload bytes are bounded; overflow emits an explicit diagnostic and follows the configured fail/omit policy;
- `persisted` and `persistenceFailed` are separate durability events and do not claim durable exactly-once delivery.
