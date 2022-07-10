<h1 align="center">
  <br>
  <a href="https://github.com/alexberriman/cleardb"><img src="./logo.svg" alt="cleardb" height="120"></a>
  <br>
  cleardb
  <br>
</h1>

> :warning: **This package is under active development**: Compatibility and APIs may change.

<h4 align="center">A zero-dependency local JSON database written in Typescript.</h4>

<p align="center">
  <a href="#key-features">Key Features</a> •
  <a href="#why">Why?</a> •
  <a href="#installation">Installation</a> •
  <a href="#basic-example">Basic Example</a> •
  <a href="#api">API</a> •
  <a href="#comparison">Comparison</a> •
  <a href="#changelog">Changelog</a> •
  <a href="#license">License</a>
</p>

## Key Features

- **written in typescript**
- **zero dependencies**
- **minimal size:** less than `1kb` minified + zipped
- **works with plain JavaScript too** - you don't need to use TypeScript.
- **isomorphic:** works in Node.js and all modern browsers.

## Why?

JSON data structures are at the the very core of JS/TS development, and the need often arises to be able to perform complex queries and transformations against that data.

This is easily enough implemented programatically through Javascript's `Array` and `Object` prototype methods, however there is no clear solution when you want to perform dynamic operations against that dataset as you would a database. This is needed for instance, when you want to securely execute user supplied queries and transformations against a JSON data source.

## Installation

```bash
$ npm install cleardb
```

## Basic Example

#### Using a single collection

```ts
import cleardb from "cleardb";

const users = [
  { id: 1, name: "harry", house: "gryffindor", born: 1980, married: true },
  { id: 2, name: "hermione", house: "gryffindor", born: 1979, married: false },
  { id: 3, name: "ron", house: "gryffindor", born: 1980, married: false },
  { id: 4, name: "draco", house: "slytherin", born: 1980, married: true },
];
const db = new cleardb(users);

db.$.find({ house: "slytherin" });
// => [ { id: 4, name: "draco", house: "slytherin", born: 1980 } ]
```

#### Using multiple collections

```ts
import cleardb from "cleardb";

const db = {
  houses: [
    { id: 'gryffindor', emblem: 'lion' },
    { id: 'hufflepuff', emblem: 'badger' },
    { id: 'ravenclaw', emblem: 'eagle' },
    { id: 'slytherin', emblem: 'serpent' }
  ],
  users: [
    { id: 1, name: "harry", house: "gryffindor", born: 1980, married: true },
    { id: 4, name: "draco", house: "slytherin", born: 1980, married: true }
  ]
];
const db = new cleardb(db);

db.$.users.find({ name: "draco" }).with(['houses', 'house']);
// => [ { id: 4, name: "draco", house: { "id": "slytherin", "emblem": "serpent" }, born: 1980 } ]
```

## API

- [Philosophy](#philosophy) ❌
- [Adapters](#adapters) ❌
  - [Memory adapter](#memory-adapter) ❌
  - [File adapter](#file-adapter) ❌
- [Database](#database) ❌
  - [`new cleardb(options)`](#options)
  - [.write](#write) ❌
  - [.delete](#delete) ❌
  - [.observe](#observe) ❌
  - [.unobserve](#unobserve) ❌
- [Collections](#collections)
  - [`new Collection(options)`](#collection-options)
  - [.get](#get) ✅
  - [.find](#find) ✅
  - [.insert](#insert) ❌
  - [.update](#update) ❌
  - [.upsert](#upsert) ❌
  - [.delete](#delete) ❌
  - [.patch](#patch) ❌
  - [.createPatch](#create-changeset) ❌
  - [.expand](#expand) ❌
  - [.sort](#sort) ❌
  - [.limit](#limit) ✅
  - [.offset](#offset) ✅
  - [.observe](#observe) ❌
  - [.unobserve](#unobserve) ❌
  - [.or](#or) ❌
  - [.assert](#assert) ❌
- [Querying](#querying) ❌
  - [By primary key](#by-primary-key) ✅
  - [Basic conditions](#basic-conditions) ✅
  - [Advanced conditions](#advanced-conditions) ✅
    - [`every` and `some`](#every-and-some) ✅
    - [Operators](#operators) ✅
      - [equal](#equal) ✅
      - [notEqual](#toLower) ✅
      - [lessThan](#toString) ✅
      - [lessThanInclusive](#toNumber) ✅
      - [greaterThan](#toLength) ✅
      - [greaterThanInclusive](#toLength) ✅
      - [in](#toLength) ✅
      - [notIn](#toLength) ✅
      - [contains](#toLength) ✅
      - [notContains](#toLength) ✅
      - [startsWith](#toLength) ✅
      - [endsWith](#toLength) ✅
      - [matchesRegex](#toLength) ✅
      - [doesNotMatchRegex](#toLength) ✅
    - [Preprocessors](#preprocess)
      - [toUpper](#toUpper) ✅
      - [toLower](#toLower) ✅
      - [toString](#toString) ✅
      - [toNumber](#toNumber) ✅
      - [toLength](#toLength) ✅
      - [substring](#toLength) ✅
      - [Custom](#custom-preprocessors)
  - [By function](#by-functions) ✅
  - [Extensions](#extensions) ❌
    - [JsonLogic](#json-logic) ❌
- [Relationships](#relationships) ❌
  - [one to one](#one-to-one) ❌
  - [one to many](#one-to-many) ❌
  - [many to many](#many-to-many) ❌
- [Indexing](#indexing) ❌
  - [Primary key](#primary-key) ❌
  - [Secondary keys](#secondary-keys) ❌
- [Asynchronous operations](#asynchronous-operations) ❌
- [Extending](#extending-cleardb) ❌
  - [Lodash example](#lodash-example) ❌
  - [Ramda example](#ramda-example) ❌
- [Guides and concepts](#guides-and-concepts) ❌
  - [Type inference](#type-inference) ❌
  - [Error handling](#error-handling) ❌
  - [Patching](#applying-patches) ❌
  - [Pagination](#pagination) ❌

## Comparison

#### lowdb

#### couchdb

#### lokijs

## Changelog

View the changelog at [CHANGELOG.md](CHANGELOG.md)

## License

[MIT](https://tldrlegal.com/license/mit-license)
