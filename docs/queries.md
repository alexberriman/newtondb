# Query grammar and complexity

Serializable queries contain data only. Grammar format `1` supports `and`, `or`, `not`, `eq`, `ne`, `in`, ordered comparisons, `contains`, `startsWith`, and `endsWith`. Regex and arbitrary functions are intentionally absent. `queryJsonSchema` publishes the JSON Schema 2020-12 shape; `parseWhere` is the runtime authority.

Comparisons do not coerce types. Equality is strict, ordered comparisons require matching number or string domains, string containment requires a string operand, and array containment uses exact element identity. Missing differs from `null`.

The parser limits depth, nodes, path tokens, set cardinality, per-scalar bytes, and aggregate scalar bytes. Execution visits at most 100,000 candidates, returns at most 100,000 documents, sorts at most 100,000 matches, and accepts at most eight order fields. These are absolute safety ceilings for the supported envelope, not user-tunable performance hints.

Complexity is:

- primary-key equality: expected `O(1)` lookup;
- declared secondary equality: expected `O(1 + matches)` plus stable-position ordering;
- scan: `O(n)` candidates;
- ordering: `O(m log m)` for `m` matches;
- limit without ordering: stops once the requested page is collected;
- serialization: proportional to returned JSON bytes.

`explain()` returns the stable strategy category (`primary`, `secondary`, or `scan`) and optional index name. It is diagnostic—not a promise about future internal planner structure.

`localPredicate()` wraps trusted process-local code. It is not serializable, portable, preemptible, or safe for untrusted input.
