# Support matrix and limits

| Area                             | Supported                                                                                    |
| -------------------------------- | -------------------------------------------------------------------------------------------- |
| Node.js                          | `^22.13.0` and `>=24.0.0` maintained LTS lines                                               |
| TypeScript declarations          | 6.0.x, strict NodeNext; bundler resolution is package-tested                                 |
| Modules                          | ESM only                                                                                     |
| Browser                          | Unsupported                                                                                  |
| Core operating systems           | Any supported Node runtime for memory use                                                    |
| Crash-qualified file persistence | Linux, local filesystem with atomic same-directory rename and file/directory sync            |
| CommonJS                         | Unsupported; use dynamic `import()` from CJS                                                 |
| Working set                      | In-memory; reference envelope 100,000 records / 11.2 MB canonical JSON                       |
| Writers                          | One cooperative owner per file; CAS-capable custom adapters may define stronger coordination |

The measured envelope is schema/workload-specific. Wider records, more indexes, broad event retention, and different filesystems change memory and latency. The absolute JSON-file byte ceiling is 64 MiB, but it does not imply that every 64 MiB dataset fits the published working-set envelope.

Only root, `newtondb/node`, `newtondb/testing`, and `newtondb/package.json` exports are public. Deep imports, browser bundling, SQL, joins, replication, caching, regex queries, ordered indexes, cursor pagination, durable events, and compatibility layers are not supported.
