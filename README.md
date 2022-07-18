<h1 align="center" id="top">
  <a href="https://github.com/alexberriman/newtondb"><img src="./logo.svg" alt="newtondb" height="190"></a>
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
  - [Why?](#why)
  - [Key features](#key-features)
- [Installation](#installation)
- [Basic usage](#basic-usage)
- [Basic principles](#basic-principles)
  - [Adapters](#adapters)
  - [Input data](#input-data)
  - [Indexing](#indexing)
  - [Chaining](#chaining)
  - [Committing mutations](#committing-mutations)
- [Adapters](#adapters)
  - [Memory adapter](#memory-adapter)
  - [File adapter](#file-adapter)
  - [URL adapter](#url-adapter)
- [Database](#database)
  - [`new newton(options)`](#options)
  - [.read](#read)
  - [.write](#write)
  - [.observe](#observe)
  - [.unobserve](#unobserve)
- [Collections](#collections)
  - [`new Collection(options)`](#collection-options)
  - [.get()](#get)
  - [.find()](#find)
  - [.data](#data)
  - [.count](#count)
  - [.exists](#exists)
  - [.select()](#select)
  - [.insert()](#insert)
  - [.set()](#set)
  - [.replace()](#replace)
  - [.delete()](#delete)
  - [.orderBy()](#orderby)
  - [.limit()](#limit)
  - [.offset()](#offset)
  - [.commit()](#commit)
  - [.assert()](#assert)
  - [.observe()](#observe)
  - [.unobserve()](#unobserve)
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
- [License](#license)

## Introduction

### Why?

JSON data structures are at the heart of most Javascript/Typescript development. Manipulating arrays and objects programatically can be accomplished easily enough using Javascript's Array and Object prototype methods, however there are times when one may want to interact with a JSON data source as they might a more traditional database. Common use cases include:

- Safely executing serializable queries.
- Safely executing data transformations.
- Querying against large datasets where performance and optimization becomes important.
- Observing changes to your data and executing callbacks.
- Reading from and writing to a destination on changes.

### Key features

Although Newton doesn't aim to replace a traditional database, it does borrow some features to let you interact with your JSON data more effectively. It does this through implementing:

- A serializable query language to query your data.
- Primary and secondary indexes to improve the efficiency of read operations.
- Adapters to read and persist your data to common locations (e.g. the filesystem, an s3 bucket, etc.)
- Configurable callbacks that are triggered on mutations.

Newton prioritizes performance and extendibility. Pending updates before an initial `1.0` release will include additional performance optimizations, including: sort keys, query caching, relational data and eager/lazy loading.

## Installation

Using npm:

```bash
$ npm install newtondb
```

Or with yarn:

```bash
$ yarn add newtondb
```

## Basic usage

#### Using a single collection:

```ts
import newton from "newtondb";

const scientists = [
  { name: "Isaac Newton", born: "1643-01-04T12:00:00.000Z" },
  { name: "Albert Einstein", born: "1879-03-14T12:00:00.000Z" },
];
const db = new newton(scientists);

db.$.get({ name: "Isaac Newton" });
// => { name: "Isaac Newton", born: "1643-01-04T12:00:00.000Z" }
```

#### Using multiple collections:

```ts
import newton from "newtondb";

const db = {
  scientists: [
    { name: "Isaac Newton", born: "1643-01-04T12:00:00.000Z" },
    { name: "Albert Einstein", born: "1879-03-14T12:00:00.000Z" }
  ],
  universities: [
    { name: "University of Zurich", location: "Zurich, Switzerland" }
  ]
];
const db = new newton(db);

db.$.universities.get({ location: "Zurich, Switzerland" })
// => { name: "University of Zurich", location: "Zurich, Switzerland" }
```

## Basic principles

### Adapters

An Adapter is what Newton uses to read and write to a data source. Put simply, an Adapter is a class with both a `read` and `write` method to be able to read from and write changes to your data source. Newton does its best to infer the adapter you're wanting to use based on the original argument passed to it. For example:

- If a data object of a certain shape is passed to it, Newton will instantiate a new `MemoryAdapter` instance.
- If a file path is passed to it, Newton will instantiate a new `FileAdapter` instance.
- If a URL is passed to it, Newton will instantiate a new `UrlAdapter` instance.

You can extend Newton by creating your own Adapters and passing instances of those adapters through when you instantiate your database. For more information, see [custom adapters](#custom-adapters).

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

You can configure one or more secondary indexes to maintain hashmaps for attributes that are commonly queried. For example, if you had a data source of 20,000 scientists, and you often queried against universities, you may want to create a secondary index for the `university` attribute. When you then executed the following query:

```ts
$.find({ university: "berlin", isAlive: true });
```

Rather than iterating over all 20,000 records, newton would instead iterate over the records in the hashmap with `university` as the hash (in which there might only be 100 records). You can set up multiple secondary indexes to increase performance even more as your dataset grows.

### Chaining

Newton functions using a concept of operation chaining, where the data output from one operation feeds in as input to the subsequent operation. For example, when updating a record, Newton's update function doesn't take as input a query of records to update against. Rather, if you wanted to update a set of records that matched a particular query, you would first `find` those records and then call `set`:

```ts
// update all records where "university" = 'berlin' to "university" = 'University of Berlin'
$.find({ university: "berlin" }).set({ university: "University of Berlin" });
```

This allows you to set up complex chains and transformations on your data.

### Committing mutations

Mutations are only persisted to the original data source when `.commit` is called on your chain.

```ts
$.scientists
  .find({ university: "berlin" })
  .set({ university: "University of Berlin" }).data;

// => [ { "code": "isa", "name": "Isaac Newton", "university": "University of Berlin" } ]
```

In the above example, the `university` attribute for all scientists studying at the `"berlin"` university is set to `"University of Berlin"`, and you can access that data through the `.data` property. However, if you were to then query for scientists attending the `"University of Berlin"` you would receive an empty result:

```ts
$.scientists.find({ university: "University of Berlin" }).data;
// => []
```

In order to persist mutations within your chain to the original data source, you must call `.commit`:

```ts
$.scientists
  .find({ university: "berlin" })
  .set({ university: "University of Berlin" })
  .commit(); // commits the mutations defined in the chain
```

You can then query against the updated items:

```ts
$.scientists.find({ university: "University of Berlin" }).count;
// => 1
```

## Collections

### new Collection(options)

Instantiates a new collection instance. The following options are supported:

| Option       | Type                 | Required | Default value | Description                                                                                                                                                                                                                                                     |
| ------------ | -------------------- | -------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `primaryKey` | `string \| string[]` | `false`  | `undefined`   | A single property (or an array of properties for a composite key) that is used to uniquely identify a record. (`id` is commonly used). Not required, but will dramatically speed up read operations when querying by primary key.                               |
| `copy`       | `boolean`            | `false`  | `false`       | When mutations are committed using `commit`, the original data object will be updated. This can sometimes lead to unintended side effects (when using the `MemoryAdapter`). Set `copy` to `true` to create a deep copy of the collection data on instantiation. |

### `.get()`

Returns a single record. Most commonly used when querying your collection by a unique identifier:

```ts
$.get({ code: "isa" }).data;
// => { "code": "isa", "name": "Isaac Newton", "university": "berlin" }
```

When your collection has been instantiated with a primary key, and your primary key is a single property whose value is a scalar (e.g. a `string` or a `number`), you can call `.get` with that scalar value and Newton will infer the fact that you're querying against your primary key:

```ts
$.get("isa").data;
// => { "code": "isa", "name": "Isaac Newton", "university": "berlin" }
```

You can query using a [primary key](#by-primary-key), a [basic condition](#basic-condition), an [advanced condition](#advanced-condition) or a [function](#by-function).

<div align="right"><a href="#top">Back to top</a></div>

### `.find()`

Returns multiple records:

```ts
$.find({ university: "cambridge" }).data;
// => [ { "code": "alb", "name": "Albert Einstein", "university": "cambridge" } ]
```

Will return an empty array when no results are found.

You can query using a [primary key](#by-primary-key), a [basic condition](#basic-condition), an [advanced condition](#advanced-condition) or a [function](#by-function).

<div align="right"><a href="#top">Back to top</a></div>

### `.data`

The `data` property returns an array of data as it currently exists within your chain. For example, referencing `.data` on the root collection will return an array of all data in your collection:

```ts
$.data;
// => [ { "name": "Isaac Newton", "born": "1643-01-04T12:00:00.000Z" }, ... ]
```

When you start chaining operations, `.data` will return an array of data as it currently exists within your chain:

```ts
$.find({ name: "Isaac Newton" }).data;
// => [ { "name": "Isaac Newton", "born": "1643-01-04T12:00:00.000Z" } ]
```

<div align="right"><a href="#top">Back to top</a></div>

### `.count`

The `count` property returns the amount of records currently within your chain. When executed from the base collection, it will return the total amount of records in your collection:

```ts
$.count;
// => 100
```

When you start chaining operations, `.count` will return the amount of records that currently exist within your chain:

```ts
$.find({ name: "Isaac Newton" }).count;
// => 1
```

<div align="right"><a href="#top">Back to top</a></div>

### `.exists`

The `exists` property is a shorthand for `.count > 0` and simply returns `true` or `false` if there is a non-zero amount of items currently within your chain:

```ts
$.get("isa").exists;
// => true
```

Or when it doesn't exist:

```ts
$.get("not isaac newton").exists;
// => false
```

<div align="right"><a href="#top">Back to top</a></div>

### `.select()`

By default, when a query returns records, the result includes all of those records' attributes. To only return a subset of an object's properties, call `.select` with an array of properties to return:

```ts
$.get({ name: "Isaac Newton" }).select(["university"]).data;
// => { university: "Cambridge" }
```

Given the result of one operation is fed into another, the order of `select` doesn't matter. The above will produce the same output as:

```ts
$.select(["university"]).get({ name: "Isaac Newton" }).data;
// => { university: "Cambridge" }
```

<div align="right"><a href="#top">Back to top</a></div>

### `.insert()`

Inserts one or more records into the database.

Inserting a single record:

```ts
$.insert({
  name: "Nicolaus Copernicus",
  born: "1473-02-19T12:00:00.000Z",
}).commit();
```

You can insert multiple records by passing through an array of objects to insert:

```ts
$.insert([
  { name: "Nicolaus Copernicus", born: "1473-02-19T12:00:00.000Z" },
  { name: "Edwin Hubble", born: "1989-11-10T12:00:00.000Z" },
]).commit();
```

<div align="right"><a href="#top">Back to top</a></div>

### `.set()`

Updates a set of attributes on one or more records.

```ts
// update isaac newton's college to "n/a" and set isAlive to false
$.find({ name: "Isaac Newton" })
  .set({ college: "n/a", isAlive: false })
  .commit();
```

`set` can also take as input a function whose first argument is the current value of the record, and which must return a subset of the record to update:

```ts
// uppercase all universities using .set
$.set(({ university }) => ({
  university: university.toUpperCase(),
})).commit();
```

> :warning: this differs from `replace()` in that it will only update/set the attributes passed through, whereas `replace()` will replace the entire document.

<div align="right"><a href="#top">Back to top</a></div>

### `.replace()`

Replaces an entire document with a new document:

```ts
const newNewton = {
  name: "Isaac Newton",
  isAlive: false,
  diedOn: "1727-03-31T12:00:00.000Z",
};

$.get("Isaac Newton").replace(newNewton).commit();
```

`replace` can also take as input a function whose first argument is the current value of the record, and which must return a complete new record:

```ts
// uppercase all universities using .replace
$.replace((record) => ({
  ...record,
  university: university.toUpperCase(),
})).commit();
```

<div align="right"><a href="#top">Back to top</a></div>

### `.delete()`

Deletes one or more records from the collection.

`delete()` doesn't take any arguments. Rather, it deletes the records that currently exist within the chain at the time that it's called. For example:

```ts
// delete all records from a collection
$.delete().commit();

// delete all scientists from cambridge university
$.find({ university: "cambridge" }).delete().commit();

// delete a single record
$.get("isaac newton").delete().commit();
```

<div align="right"><a href="#top">Back to top</a></div>

### `.orderBy()`

`orderBy` can be used to sort records by one or more properties. It takes as input a single object whose properties are a key of your collection's properties, and whose value is either `asc` (for ascending) or `desc` (for descending).

For example, using the below dataset:

```ts
const students = [
  { name: "roger galilei", university: "mit" },
  { name: "kip tesla", university: "harvard" },
  { name: "rosalind faraday", university: "harvard" },
  { name: "thomas franklin", university: "mit" },
  { name: "albert currie", university: "harvard" },
];
```

To sort by university in descending order and name in ascending order:

```ts
$.orderBy({ university: "desc", name: "asc" }).data;
```

This will produce the following:

```json
[
  { "name": "roger galilei", "university": "mit" },
  { "name": "thomas franklin", "university": "mit" },
  { "name": "albert currie", "university": "harvard" },
  { "name": "kip tesla", "university": "harvard" },
  { "name": "rosalind faraday", "university": "harvard" }
]
```

Given the order by which you sort is important, `orderBy()` will adhere to the order of the properties in the object passed through.

For example, in the above example, `{ university: "desc", name: "asc" }` was passed through. `orderBy` would first sort by `university` in `descending` order, and then by `name` in ascending order.

If you were to instead pass through `{ name: "asc", university: "desc" }`, `orderBy` would first sort by name in `ascending` order and then by `university` in `descending` order. This would produce a different result:

```json
[
  { "name": "albert currie", "university": "harvard" },
  { "name": "kip tesla", "university": "harvard" },
  { "name": "roger galilei", "university": "mit" },
  { "name": "rosalind faraday", "university": "harvard" },
  { "name": "thomas franklin", "university": "mit" }
]
```

<div align="right"><a href="#top">Back to top</a></div>

### `.limit()`

You can use `limit` to only return the first `n` amount of records within your chain:

```ts
$.find({ university: "cambridge" }).limit(5).data;
```

Will return the first 5 records with `university` set to `"cambridge"`.

You can use `limit` with `offset` to implement an offset based pagination on your data.

<div align="right"><a href="#top">Back to top</a></div>

### `.offset()`

`offset` will skip the first `n` records from your query. For example, to skip the first 5 records:

```ts
$.find({ university: "cambridge" }).offset(5).data;
```

`offset` can be used with `limit` to implement an offset based pagination:

```ts
const pageSize = 10;
const currentPage = 3;

$.find()
  .limit(pageSize)
  .offset((currentPage - 1) * pageSize).data;
```

<div align="right"><a href="#top">Back to top</a></div>

### `.commit()`

The following operations can mutate (change) your data:

- [set()](#set)
- [replace()](#replace)
- [delete()](#delete)
- [insert()](#insert)

Mutations will only be persisted/committed to your collection when `.commit()` is called. This is useful as it allows you to:

1. Perform temporary transformations on your data, and
1. Create complex chains

What's more, by requiring a call to `commit` Newton confirms your intent to mutate the original data source, reducing the risk for unintended side effects throughout your application.

<div align="right"><a href="#top">Back to top</a></div>

### `.assert()`

Runs an `assertion` on your chain, and continues the chain execution if the assertion passes and raises an `AssertionError` when it fails.

Takes as input a function whose single argument is the chain instance and which returns a `boolean`:

```ts
try {
  $.get({ name: "isaac newton" })
    .assert(({ exists }) => exists)
    .set({ university: "unknown" })
    .commit();
} catch (e: unknown) {
  if (e instanceof AssertionError) {
    // record does not exist
  }
}
```

You can optionally pass through a `string` as the first argument and a `function` as the second to describe your assertion:

```ts
try {
  $.get({ name: "isaac newton" })
    .assert(
      "the record the user is attempting to update exists",
      ({ exists }) => exists
    )
    .set({ university: "unknown" })
    .commit();
} catch (e: unknown) {
  if (e instanceof AssertionError) {
    // record does not exist
  }
}
```

<div align="right"><a href="#top">Back to top</a></div>

### `.observe()`

When mutations to the data source are committed, one or more of the following events will be raised:

- [insert](#insert): raised when a record is inserted into the collection
- [delete](#delete): raised when a record is deleted from the collection
- [updated](#updated): raised when a record is updated

You can pass callbacks to the `observe` method that will be triggered when these events occur.

On insert:

```ts
const onInsert = $.observe("insert", (record) => {
  //
});
```

On delete:

```ts
const onDelete = $.observe("delete", (record) => {
  //
});
```

On update:

```ts
const onUpdate = $.observe("updated", (record, historical) => {
  // historical.old = item before update
  // historical.new = item after update
});
```

You can also pass through a wildcard observer which will be triggered on every event:

```ts
const wildcardObserver = $.observe((event, data) => {
  // event: "insert" | "delete" | "updated"
  // data: event data
});
```

Calls to `.observe()` will return an numeric id of the observer. This id should be passed to `unobserve()` to cancel the observer.

<div align="right"><a href="#top">Back to top</a></div>

### `.unobserve()`

Cancels an observer set with the `.observe()` method. Takes as input a numeric ID (which should correspond to the output of the original `.observe` call).

<div align="right"><a href="#top">Back to top</a></div>

## License

[MIT](https://tldrlegal.com/license/mit-license)

```

```
