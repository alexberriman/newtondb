# [0.3.0](https://github.com/alexberriman/newtondb/compare/v0.2.0...v0.3.0) (2022-08-02)


### Features

* **collection:** add or property to conditionally execute chain operations ([dc4fb79](https://github.com/alexberriman/newtondb/commit/dc4fb79297edf21ec79d302373763b787f881cac))





<details>
<summary>View benchmarks</summary>

- `db.get` (1000k records): 
  - **native** `Array.prototype.find()`: 116 ops/s
  - **newton** without PK: 2 ops/s
  - **newton** with pk: 15205 ops/s
- `db.find` (1000k records): 
  - **native** `Array.prototype.find()`: 113 ops/s
  - **newton** without PK: 6 ops/s
  - **newton** with pk: 74274 ops/s
- `new Newton()`: 
  - 1k records: 4401 ops/s
  - 10k records: 381 ops/s
  - 100k records: 9 ops/s
  - 1000k records: 1 ops/s

</details>

# Changelog

## [0.2.0](https://github.com/alexberriman/newtondb/compare/v0.1.2...v0.2.0) (2022-07-26)

### Features

- **querying:** add not condition ([fe02ded](https://github.com/alexberriman/newtondb/commit/fe02ded504fce1280718548e918a513647f38955))
- **utils:** cloneDeep, set, unset ([decbc5c](https://github.com/alexberriman/newtondb/commit/decbc5c1e0e00d95195701c04811e420e56654ab))
