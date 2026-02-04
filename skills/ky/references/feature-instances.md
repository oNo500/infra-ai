---
name: feature-instances
description: Creating custom instances with ky.create() and ky.extend() for reusable configurations
---

# Instances

Create custom Ky instances with preconfigured defaults for different APIs or use cases.

## ky.create()

Create a new instance with complete new defaults:

```js
import ky from 'ky';

const api = ky.create({
  prefixUrl: 'https://api.example.com',
  timeout: 30000,
  headers: {
    'Authorization': 'Bearer token123'
  }
});

// Uses configured defaults
await api.get('users/123');
// => https://api.example.com/users/123

// Override defaults per request
await api.get('/status', {prefixUrl: ''});
// => https://my-site.com/status
```

Use cases:
- API-specific clients with different base URLs
- Independent configurations
- Multiple API services in one application

## ky.extend()

Create a new instance that inherits from parent:

```js
import ky from 'ky';

const api = ky.create({
  prefixUrl: 'https://api.example.com',
  headers: {
    'x-api-version': '1.0',
    'authorization': 'Bearer token'
  },
  hooks: {
    beforeRequest: [() => console.log('before 1')],
    afterResponse: [() => console.log('after 1')]
  }
});

const extendedApi = api.extend({
  headers: {
    'x-api-version': undefined,  // Remove header
    'x-custom': 'value'           // Add header
  },
  hooks: {
    beforeRequest: undefined,  // Remove all beforeRequest hooks
    afterResponse: [() => console.log('after 2')]  // Add to existing
  }
});

// Result:
// Headers: {authorization, x-custom}
// Hooks: {afterResponse: [after 1, after 2]}
```

## Removing Headers and Hooks

Remove inherited values by setting them to `undefined`:

```js
const base = ky.create({
  headers: {'x-foo': 'bar', 'x-baz': 'qux'}
});

const extended = base.extend({
  headers: {
    'x-foo': undefined  // Remove this header
  }
});
```

## Function-Based Extension

Use a function to access parent defaults:

```js
const api = ky.create({
  prefixUrl: 'https://api.example.com'
});

const usersApi = api.extend((options) => ({
  prefixUrl: `${options.prefixUrl}/users`
}));

await usersApi.get('123');
// => https://api.example.com/users/123
```

## Context for Hooks

Pass contextual data to hooks without polluting the request:

```js
const api = ky.create({
  hooks: {
    beforeRequest: [
      (request, options) => {
        const {token} = options.context;
        if (token) {
          request.headers.set('Authorization', `Bearer ${token}`);
        }
      }
    ]
  }
});

await api('https://api.example.com', {
  context: {
    token: 'secret123'
  }
});
```

Context properties:
- Always guaranteed to be an object (never `undefined`)
- Shallow merged (top-level properties only)
- Only enumerable properties are copied

## Practical Patterns

### API Client with Multiple Endpoints

```js
const api = ky.create({
  prefixUrl: 'https://api.example.com',
  timeout: 10000
});

const usersApi = api.extend({prefixUrl: 'https://api.example.com/users'});
const postsApi = api.extend({prefixUrl: 'https://api.example.com/posts'});

await usersApi.get('123');  // /users/123
await postsApi.get('456');  // /posts/456
```

### Environment-Specific Clients

```js
const baseApi = ky.create({
  timeout: 30000,
  retry: 3
});

const prodApi = baseApi.extend({
  prefixUrl: 'https://api.production.com'
});

const devApi = baseApi.extend({
  prefixUrl: 'https://api.development.com'
});
```

<!--
源引用:
- https://github.com/sindresorhus/ky/blob/main/readme.md#kyextenddefaultoptions
- https://github.com/sindresorhus/ky/blob/main/readme.md#kycreatedefaultoptions
- https://github.com/sindresorhus/ky/blob/main/readme.md#context
-->
