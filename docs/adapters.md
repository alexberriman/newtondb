# Adapter authoring

`StorageAdapter<Seed>` has three asynchronous operations: `load`, conditional `store`, and `close`. `load` runs once before any store. `store` receives an immutable snapshot and the exact expected generation; it must atomically install generation `expectedGeneration + 1` or reject with a conflict. Its acknowledgement must match database identity and generation and cover the requested revision.

Adapters must detach retained values, serialize stores, keep acknowledgements monotonic, release resources on idempotent close, and never acknowledge durability they do not provide. Mutable storage needs either atomic compare-and-swap or an exclusive fenced writer lease held from before load through close. Watching, streaming, and arbitrary capability negotiation are outside the contract.

Use `MemoryStorageAdapter` as a non-durable reference and `runAdapterConformance` to verify empty load, conditional store, reopen, stale generation, and close behavior. Wrap an adapter in `FaultInjectionAdapter` to delay, reject, hang, or corrupt calls. Passing these checks does not prove crash safety or make extension code trusted.

An adapter may observe an `AbortSignal` where its implementation can cooperate. JavaScript callbacks and synchronous parse work cannot be forcefully preempted.
