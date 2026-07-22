# JSON, schemas, paths, and keys

Documents are plain JSON objects containing `null`, booleans, finite numbers, strings, arrays, and plain nested objects. NewtonDB rejects cycles, sparse arrays, accessors, symbols, functions, bigint, non-finite numbers, non-plain prototypes, and values exceeding the fixed safety ceilings. Validation clones through property descriptors, creates null-prototype objects, calculates exact serialized bytes, and recursively freezes the result.

Default hard ceilings are 64 levels, 100,000 nodes, 1 MiB serialized per document, and 256 KiB per string or property name. Schema overrides may only narrow these ceilings. A synchronous schema validator may reject a detached frozen document; it must not transform data or re-enter the engine.

Every collection declares an immutable primary-key field. Keys are non-empty strings or safe integers; generated keys are strings. The tagged key codec keeps string and numeric domains distinct. Primary-key changes fail before publication. Declared secondary indexes accept JSON primitives and may be unique.

Property paths are token arrays such as `['profile', 'name']` or `['items', 0, 'sku']`. Numeric tokens mean array positions and string tokens mean object properties. Reads use own data descriptors only, including safely handling names such as `__proto__` and `constructor`. `formatPath` and `parsePath` provide a lossless JSON-Pointer-compatible representation with explicit numeric tokens.

Collection schemas are runtime contracts, not a general JSON Schema implementation. Use the optional validator to integrate a schema library, while keeping transformation and default insertion outside the database transaction.
