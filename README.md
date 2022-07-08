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
  <a href="#api">API</a> •
  <a href="#example">Example</a> •
  <a href="#license">License</a>
</p>

## Key Features

- **written in typescript**
- **zero dependencies**
- **minimal size:** less than `1kb` minified + zipped
- **works with plain JavaScript too** - you don't need to use TypeScript.
- **isomorphic:** works in Node.js and all modern browsers.

## Why?

JSON data structures are at the the very core of Javascript development and the need often arises to be able to perform complex queries and transformations against your data. This is easily enough implemented through `Array` and `Object` prototype methods, however it can be argued that when compared to querying a database these methods:

- can introduce unnecessary complexity into your code
- can negatively impact readability
- can impact performance if not implemented correctly

What's more, it's fairly common to want to securely execute user supplied queries and transformations against a dataset which `cleardb` can do out of the box.

## Installation

```bash
$ npm install cleardb
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

## Example

```ts
// example goes here
```

## License

[MIT](https://tldrlegal.com/license/mit-license)
