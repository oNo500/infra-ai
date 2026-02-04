---
name: core-usage
description: Basic usage patterns and HTTP method shortcuts in Ky
---

# Core Usage

Ky is a tiny and elegant HTTP client based on the Fetch API. It provides a simpler, more powerful API than plain fetch.

## Basic Usage

```js
import ky from 'ky';

const json = await ky.post('https://example.com', {json: {foo: true}}).json();
```

## HTTP Method Shortcuts

Ky provides convenient method shortcuts that set the HTTP method automatically:

- `ky.get(input, options?)`
- `ky.post(input, options?)`
- `ky.put(input, options?)`
- `ky.patch(input, options?)`
- `ky.head(input, options?)`
- `ky.delete(input, options?)`

```js
// GET request
const user = await ky.get('https://api.example.com/user/123').json();

// POST request with JSON body
const result = await ky.post('https://api.example.com/users', {
  json: {name: 'John', email: 'john@example.com'}
}).json();

// PUT request
const updated = await ky.put('https://api.example.com/users/123', {
  json: {name: 'Jane'}
}).json();
```

## Response Body Methods

Ky enhances the Response object with convenient body methods that automatically handle errors:

- `.json()` - Parse JSON response
- `.text()` - Get text response
- `.formData()` - Get FormData response
- `.arrayBuffer()` - Get ArrayBuffer response
- `.blob()` - Get Blob response
- `.bytes()` - Get Uint8Array (when supported)

```js
// JSON response
const data = await ky('/api/data').json();

// Text response
const html = await ky('/page').text();

// Binary data
const buffer = await ky('/file').arrayBuffer();
```

## TypeScript Support

Ky provides excellent TypeScript support with generic types:

```ts
interface User {
  id: number;
  name: string;
}

// Type the response
const user1 = await ky<User>('/api/users/1').json();
const user2 = await ky('/api/users/2').json<User>();
```

## Key Differences from Fetch

- Simpler API with method shortcuts
- Automatically treats non-2xx status codes as errors
- Built-in retry mechanism
- Timeout support
- JSON option for automatic serialization
- URL prefix option for easier instance creation

<!--
源引用:
- https://github.com/sindresorhus/ky/blob/main/readme.md#usage
- https://github.com/sindresorhus/ky/blob/main/readme.md#kyget-input-options
-->
