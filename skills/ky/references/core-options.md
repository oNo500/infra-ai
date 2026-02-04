---
name: core-options
description: Essential configuration options including json, searchParams, prefixUrl, and timeout
---

# Core Options

Core configuration options that extend the standard Fetch API.

## json

Send JSON data automatically with correct headers:

```js
import ky from 'ky';

const response = await ky.post('https://api.example.com/users', {
  json: {
    name: 'John Doe',
    email: 'john@example.com'
  }
});
```

The `json` option:
- Automatically sets `Content-Type: application/json`
- Serializes the object with `JSON.stringify()`
- Can accept any value supported by `JSON.stringify()`

## searchParams

Add query parameters easily:

```js
const response = await ky('https://api.example.com/search', {
  searchParams: {
    q: 'ky http client',
    limit: 10,
    offset: 0
  }
});
// => https://api.example.com/search?q=ky+http+client&limit=10&offset=0
```

Supported types:
- String: `'key1=value1&key2=value2'`
- Object: `{key: value}`
- Array: `[['key', 'value']]`
- URLSearchParams instance

Special handling:
- `undefined` values are filtered out
- `null` values are preserved as string `'null'`
- Overrides existing search parameters in the URL

## prefixUrl

Prepend a base URL to all requests:

```js
const api = ky.create({
  prefixUrl: 'https://api.example.com'
});

// Makes request to https://api.example.com/users
await api.get('users');

// Makes request to https://api.example.com/posts/123
await api.get('posts/123');
```

Important notes:
- Only works when `input` is a string (not Request instance)
- Input URL cannot start with `/` when using prefixUrl
- Trailing slash is automatically handled
- Result is resolved against the page's base URL

## timeout

Set request timeout in milliseconds:

```js
// 5 second timeout
const response = await ky('https://api.example.com', {
  timeout: 5000
});

// No timeout
const response = await ky('https://api.example.com', {
  timeout: false
});
```

Default: `10000` (10 seconds)
- Includes all retries
- Maximum value: 2147483647
- Set to `false` to disable timeout
- Throws `TimeoutError` when exceeded

## method

HTTP method (usually set via shortcuts):

```js
// Explicit method
await ky('https://api.example.com', {method: 'post'});

// Using shortcuts (recommended)
await ky.post('https://api.example.com');
```

Standard methods are automatically uppercased to avoid server errors.

<!--
源引用:
- https://github.com/sindresorhus/ky/blob/main/readme.md#json
- https://github.com/sindresorhus/ky/blob/main/readme.md#searchparams
- https://github.com/sindresorhus/ky/blob/main/readme.md#prefixurl
- https://github.com/sindresorhus/ky/blob/main/readme.md#timeout
-->
