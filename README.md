<h1 align="center">
  <br>
  <a href="https://github.com/alexberriman/cleardb"><img src="./logo.svg" alt="cleardb" height="110"></a>
  <br><br>
  cleardb
  <br>
</h1>

> :warning: **This package is under active development**: Compatibility and APIs may change.

<h4 align="center">A zero-dependency local JSON database written in Typescript.</h4>

<p align="center">
  <a href="#key-features">Key Features</a> •
  <a href="#why">Why?</a> •
  <a href="#installation">Installation</a> •
  <a href="#example">Basic Example</a> •
  <a href="#api">API</a> •
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

db.find({ house: "slytherin" });
// => [ { id: 4, name: "draco", house: "slytherin", born: 1980 } ]
```

#### Using multiple collections

```ts
import cleardb from "cleardb";

const db = {
  houses: [
    {id: 'gryffindor', emblem: 'lion'},
    {id: 'hufflepuff', emblem: 'badger'},
    {id: 'ravenclaw', emblem: 'eagle'},
    {id: 'slytherin', emblem: 'serpent'}
  ],
  users: [
    { id: 1, name: "harry", house: "gryffindor", born: 1980, married: true },
    { id: 4, name: "draco", house: "slytherin", born: 1980, married: true }
  ]
];
const db = new cleardb(db);

db.users.find({ name: "draco" }).with(['houses', 'house']);
// => [ { id: 4, name: "draco", house: { "id": "slytherin", "emblem": "serpent" }, born: 1980 } ]
```

## API

#### `exampleFunction(param: ExampleInput): ExampleOutput`

Example function.

```ts
import { exampleFunction } from "cleardb";

const result = exampleFunction({
  lorem: "ipsum",
});

// => { result: "lorem" };
```

## License

[MIT](https://tldrlegal.com/license/mit-license)
