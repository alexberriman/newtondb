# Transactions, concurrency, and events

Transactions use collection-granular serializable optimistic validation. Reading, querying, or writing a collection records its base revision. Commit rejects if any touched collection changed, preventing stale reads, phantoms, write skew across touched collections, and lost updates. The callback is synchronous; returning a promise is rejected and rolls back the unpublished overlay.

A successful transaction publishes one immutable root and returns a receipt containing database identity, transaction identity, revision, affected count, generated keys, and durability. A persistence failure does not roll back that root: `PersistenceError.receipt` identifies the already committed transaction so callers do not retry application work accidentally.

Transactions are bounded to 30 seconds, 10,000 operations, and 1,000 read collections; configuration can only narrow these ceilings. There are no nested transaction callbacks.

Subscriptions receive revision-ordered, at-most-once in-memory batches after publication. Listener exceptions and diagnostic-hook exceptions are isolated from commit and from other listeners. Reentrant writes publish after the current batch. The queue is bounded to 1,024 batches and 100,000 changes; overflow omits the batch and invokes the diagnostic hook.

Event bodies are metadata-only by default. Set `eventDocuments: 'include'` to receive frozen `before` and `after` records, and treat those payloads and all hooks as sensitive application data. Events are not durable delivery and must not be used as an exactly-once message queue.
