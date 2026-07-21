# Public contract and evidence registry

This registry prevents accidental APIs and missing semantic coverage. The generated package/API report must match it before beta.

## Stable V2.0 surface

| Surface                                 | Stability          | Required evidence                                    |
| --------------------------------------- | ------------------ | ---------------------------------------------------- |
| `newtondb` root exports                 | stable             | API report, runtime/type/consumer tests              |
| `newtondb/node` exports                 | stable             | API report, Node consumer and crash tests            |
| `Database.memory`, `Database.open`      | stable             | lifecycle/type/integration tests                     |
| collection get/query/count/has          | stable             | semantic partitions, readonly alias tests            |
| transaction insert/update/delete/upsert | stable             | model/history/failure tests                          |
| query wire grammar version 1            | stable wire format | JSON Schema, truth tables, corpus/differential tests |
| error `code` and documented metadata    | stable             | error registry/serialization/redaction tests         |
| transaction and durability events       | stable             | ordering/isolation/backpressure tests                |
| snapshot envelope and format version    | stable file format | N-1/N/N+1, corruption/recovery tests                 |
| diagnostics/plan detail                 | experimental       | version field; no structural equality guarantee      |

Error messages, internal paths, stack traces, planner internals, and implementation classes are not stable unless promoted here.

## Requirements traceability

| Requirement                             | Decision       | Implementation evidence                | Release evidence                 |
| --------------------------------------- | -------------- | -------------------------------------- | -------------------------------- |
| JSON validation and immutable ownership | ADR-0002       | schema/ownership unit + property tests | hostile corpus                   |
| canonical unique immutable keys         | ADR-0002       | key/index model tests                  | randomized invariant suite       |
| strict serializable query               | ADR-0002       | parser/compiler unit tests             | scan/index differential corpus   |
| atomic serializable transaction         | ADR-0002       | state machine and fault tests          | history checker                  |
| isolated bounded events                 | ADR-0003       | event unit/integration tests           | scheduler/backpressure suite     |
| honest ordered durability               | ADR-0003       | coordinator tests                      | crash/fault matrix               |
| trusted package artifact                | ADR-0001       | pack/consumer/API tests                | registry digest/provenance check |
| supported scale                         | ADR-0001 D-009 | benchmark corpus                       | controlled qualification report  |
| native SVG identity                     | AGENTS.md      | SVG source and harness                 | five-pass report                 |
