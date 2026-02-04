---
name: advanced-customization
description: Custom JSON parsing/serializing and custom fetch implementation
---

# Advanced Customization

Customize JSON processing and fetch implementation for special use cases.

## Custom JSON Parsing

Override the default JSON parsing function:

```js
import ky from 'ky';
import bourne from '@hapi/bourne';

const json = await ky('https://api.example.com', {
  parseJson: text => bourne(text)  // Protection from prototype pollution
}).json();
```

Use cases:
- Parse JSON with protection from prototype pollution
- Use custom reviver function
- Handle special JSON formats

Example with reviver:

```js
const json = await ky('https://api.example.com', {
  parseJson: text => JSON.parse(text, (key, value) => {
    // Convert date strings to Date objects
    if (key.endsWith('_at')) {
      return new Date(value);
    }
    return value;
  })
}).json();
```

## Custom JSON Stringifying

Override the default JSON stringifying function:

```js
import ky from 'ky';
import {DateTime} from 'luxon';

const response = await ky.post('https://api.example.com', {
  json: {
    created_at: DateTime.now(),
    name: 'John'
  },
  stringifyJson: data => JSON.stringify(data, (key, value) => {
    // Convert DateTime to Unix timestamp
    if (key.endsWith('_at') && value instanceof DateTime) {
      return value.toSeconds();
    }
    return value;
  })
});
```

Use cases:
- Custom date/time serialization
- Special number formatting
- Removing sensitive fields

## Custom Fetch Implementation

Use a custom fetch function:

```js
import ky from 'ky';
import fetch from 'isomorphic-unfetch';

const json = await ky('https://api.example.com', {
  fetch
}).json();
```

Use cases:
- Use `isomorphic-unfetch` for older environments
- Use framework-specific fetch wrappers (e.g., Next.js)
- Add custom fetch middleware

Example with Next.js:

```js
// In Next.js server component
import ky from 'ky';

const api = ky.create({
  fetch: fetch  // Next.js extended fetch with caching
});

const data = await api('https://api.example.com').json();
```

## Combining Customizations

```js
const api = ky.create({
  parseJson: text => bourne(text),
  stringifyJson: data => JSON.stringify(data, replacer),
  fetch: customFetch
});
```

<!--
源引用:
- https://github.com/sindresorhus/ky/blob/main/readme.md#parsejson
- https://github.com/sindresorhus/ky/blob/main/readme.md#stringifyjson
- https://github.com/sindresorhus/ky/blob/main/readme.md#fetch
-->
