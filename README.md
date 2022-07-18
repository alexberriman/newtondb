<h1 align="center">
  <br>
  <a href="https://github.com/alexberriman/newtondb"><img src="./logo.svg" alt="newtondb" height="160"></a>
  <br>
  Newton
  <br>
</h1>

> :warning: **This package is under active development**: Compatibility and APIs may change.

<h4 align="center">A zero-dependency local JSON database written in Typescript.</h4>

<div align="center">

[![Build status](https://github.com/alexberriman/json-rules-engine-to-json-logic/actions/workflows/build.yml/badge.svg)](https://github.com/alexberriman/json-rules-engine-to-json-logic/actions) [![Version](https://img.shields.io/npm/v/json-rules-engine-to-json-logic?label=version)](https://www.npmjs.com/package/json-rules-engine-to-json-logic/) [![Minzipped Size](https://img.shields.io/bundlephobia/minzip/json-rules-engine-to-json-logic)](https://www.npmjs.com/package/json-rules-engine-to-json-logic/) [![License](https://img.shields.io/npm/l/json-rules-engine-to-json-logic)](https://github.com/alexberriman/json-rules-engine-to-json-logic/blob/main/LICENSE)

[![twitter](https://img.shields.io/badge/Twitter-1DA1F2?logo=twitter&logoColor=white)](https://twitter.com/bezz) [![github](https://img.shields.io/badge/GitHub-100000?logo=github&logoColor=white)](https://github.com/alexberriman/) [![youtube](https://res.cloudinary.com/practicaldev/image/fetch/s--cumRvkw3--/c_limit%2Cf_auto%2Cfl_progressive%2Cq_auto%2Cw_880/https://img.shields.io/badge/YouTube-FF0000%3Flogo%3Dyoutube%26logoColor%3Dwhite)](https://www.youtube.com/channel/UCji7mkyJ6T5X_D9qlWlPczw) [![linkedin](https://img.shields.io/badge/LinkedIn-0077B5?logo=linkedin&logoColor=white)](https://www.linkedin.com/in/alex-berriman/)

</div>

## Table of contents

- [Introduction](#introduction)
- [Basic principles](#basic-principles)
  - [Input data](#input-data)
- [Installation](#installation)
- [Basic usage](#basic-usage)
- [Adapters](#adapters)
  - [Memory adapter](#memory-adapter)
  - [File adapter](#file-adapter)
  - [URL adapter](#url-adapter)
- [Indexing](#indexing)
  - [Primary key](#primary-key)
  - [Secondary keys](#secondary-keys)
- [Database](#database)
  - [`new newton(options)`](#options)
  - [.read](#read)
  - [.write](#write)
  - [.observe](#observe)
  - [.unobserve](#unobserve)
- [Collections](#collections)
  - [`new Collection(options)`](#collection-options)
  - [.get](#get)
  - [.find](#find)
  - [.select](#select)
  - [.insert](#insert)
  - [.set](#set)
  - [.replace](#upsert)
  - [.delete](#delete)
  - [.orderBy](#orderBy)
  - [.limit](#limit)
  - [.offset](#offset)
  - [.assert](#assert)
  - [.observe](#observe)
  - [.unobserve](#unobserve)
- [Querying](#querying)
  - [By primary key](#by-primary-key)
  - [By function](#by-functions)
  - [Basic conditions](#basic-conditions)
  - [Advanced conditions](#advanced-conditions)
    - [`every` and `some`](#every-and-some)
    - [Operators](#operators)
      - [equal](#equal)
      - [notEqual](#toLower)
      - [lessThan](#toString)
      - [lessThanInclusive](#toNumber)
      - [greaterThan](#toLength)
      - [greaterThanInclusive](#toLength)
      - [in](#toLength)
      - [notIn](#toLength)
      - [contains](#toLength)
      - [notContains](#toLength)
      - [startsWith](#toLength)
      - [endsWith](#toLength)
      - [matchesRegex](#toLength)
      - [doesNotMatchRegex](#toLength)
    - [Preprocessors](#preprocess)
      - [toUpper](#toUpper)
      - [toLower](#toLower)
      - [toString](#toString)
      - [toNumber](#toNumber)
      - [toLength](#toLength)
      - [substring](#toLength)

## Introduction

JSON data structures are at the heart of most Javascript/Typescript development. Manipulating arrays and objects programatically can be accomplished easily enough using Javascript's Array and Object prototype methods, however there are times when one may want to interact with a JSON data source as they might a more traditional database. Common use cases include:

- Safely executing serializable queries.
- Safely executing data transformations.
- Querying against large datasets where performance and optimization becomes important.
- Observing changes to your data and executing callbacks.

Although Newton doesn't aim to replace a traditional database, it does borrow some features to let you interact with your JSON data more effectively.

## Basic principles

### Input data

When thinking of data sources expressed in JSON, you will often have arrays/lists of data objects of a given type:

```json
[
  { "name": "Isaac Newton", "born": "1643-01-04T12:00:00.000Z" },
  { "name": "Albert Einstein", "born": "1879-03-14T12:00:00.000Z" }
]
```

We define this as a `Collection`, where a Collection can have a type (in the above example we define a Collection of type `Scientist`).

One might also have a JSON data structure that defines various arrays of data of different types:

```json
{
  "scientists": [
    { "name": "Isaac Newton", "born": "1643-01-04T12:00:00.000Z" },
    { "name": "Albert Einstein", "born": "1879-03-14T12:00:00.000Z" }
  ],
  "universities": [
    { "name": "University of Zurich", "location": "Zurich, Switzerland" }
  ]
}
```

We define this as a `Database` which contains two collections:

1. `scientists` of type `Scientist`
1. `universities` or type `University`

Newton will take as input either a single `Collection` or a `Database` with one or more collections.

### Indexing

Newton operates on arrays/lists of data. However, there are performance implications when operating on arrays that starts to become more troublesome as the size of your dataset grows. Namely, when given a query or a predicate, internally you have to iterate over the entire list to determine which objects match your predicate.

Newton solves this by internally maintaining both a [linked list](https://en.wikipedia.org/wiki/Doubly_linked_list) and a set of [hash maps](https://en.wikipedia.org/wiki/Hash_table) to efficiently query your data.

For example, most data sources will often have a primary key composed of one or more attributes that uniquely identifies the item:

```json
[
  { "code": "isa", "name": "Isaac Newton", "university": "berlin" },
  { "code": "alb", "name": "Albert Einstein", "university": "cambridge" }
]
```

When instantiating newton, if you set the `primaryKey` configuration option to `["code"]`, a hash map would be created internally with `code` as the key, so that when you were to query it, newton could return the record from a single map lookup rather than iterating over the entire list:

```ts
$.get("isa").data;
// => { "code": "isa", "name": "Isaac Newton", "university": "berlin" }
```

You can also configure one or more secondary indexes to maintain hashmaps for attributes that are commonly queried. For example, if you had a data source of 20,000 scientists, and you often queried against universities, you may want to create a secondary index for the `university` attribute. When you then executed the following query:

```ts
$.find({ university: "berlin", isAlive: true });
```

Rather than iterating over all 20,000 records, newton would instead iterate over the records in the hashmap with `university` as the hash (in which there might only be 100 records). You can set up multiple secondary indexes to increase performance even more as your dataset grows.

## Installation

```bash
$ npm install newtondb    #npm
$ yarn add newtondb       #yarn
```

## Basic usage

#### Using a single collection:

```ts
import newton from "newtondb";

const users = [
  { id: 1, name: "harry", house: "gryffindor", born: 1980, married: true },
  { id: 4, name: "draco", house: "slytherin", born: 1980, married: true },
];
const db = new newton(users);

db.$.get({ name: "draco" });
// => { id: 4, name: "draco", house: "slytherin", born: 1980 }
```

#### Using multiple collections:

```ts
import newton from "newtondb";

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
const db = new newton(db);

db.$.houses.get({ emblem: "lion" })
// => { id: "gryffindor", emblem: "lion" }
```

## Comparison

#### lowdb

#### couchdb

#### lokijs

## Changelog

View the changelog at [CHANGELOG.md](CHANGELOG.md)

## License

[MIT](https://tldrlegal.com/license/mit-license)
