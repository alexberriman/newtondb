# Errors

Public failures extend `NewtonError` and carry a stable `code`. Program against codes and documented metadata—not message text.

| Code                                                 | Meaning                                                     |
| ---------------------------------------------------- | ----------------------------------------------------------- |
| `ERR_INVALID_ARGUMENT` / `ERR_INVALID_JSON_DOCUMENT` | Invalid API input or unsupported JSON                       |
| `ERR_QUERY_VALIDATION`                               | Invalid or resource-exceeding query                         |
| `ERR_DUPLICATE_KEY` / `ERR_DUPLICATE_UNIQUE_INDEX`   | Uniqueness violation                                        |
| `ERR_NOT_FOUND` / `ERR_IMMUTABLE_PRIMARY_KEY`        | Missing record or forbidden key change                      |
| `ERR_CONFLICT`                                       | Serializable transaction conflict                           |
| `ERR_PERSISTENCE`                                    | Commit published in memory but requested persistence failed |
| `ERR_STORAGE_CONFLICT` / `ERR_CORRUPT_STORAGE`       | Ownership/generation conflict or invalid stored bytes       |
| `ERR_CLOSED`                                         | Operation after close began or completed                    |

`PersistenceError.receipt` is immutable committed metadata. `QueryValidationError.issue` and `location` identify a grammar or execution limit. `NewtonError.toJSON()` includes only name, code, and message; it excludes nested causes and document bodies. Raw `cause`, validator errors, adapter errors, event batches, collection names, and filesystem diagnostics can still be sensitive and should not be logged without application redaction.
