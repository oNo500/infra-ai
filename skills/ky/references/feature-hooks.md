---
name: feature-hooks
description: Lifecycle hooks for intercepting and modifying requests, responses, retries, and errors
---

# Hooks

Hooks allow you to intercept and modify requests, responses, retries, and errors during the request lifecycle.

## Hook Types

Ky supports four hook types:
- `beforeRequest`: Modify request before sending
- `beforeRetry`: Modify request before retry
- `afterResponse`: Intercept and modify response
- `beforeError`: Modify error before throwing

All hooks are arrays of functions that run serially and can be async.

## beforeRequest

Modify the request right before it's sent:

```js
import ky from 'ky';

const api = ky.extend({
  hooks: {
    beforeRequest: [
      (request, options, {retryCount}) => {
        // Add auth header only on initial request
        if (retryCount === 0) {
          request.headers.set('Authorization', 'Bearer token');
        }
      }
    ]
  }
});
```

Hook receives:
- `request`: Normalized Request object
- `options`: Normalized options
- `state`: Object with `retryCount` (0 for initial request)

Can return:
- `Request`: Replace outgoing request
- `Response`: Skip HTTP request (for mocking/caching)
- `undefined`: Continue normally

## beforeRetry

Modify the request before retry:

```js
const response = await ky('https://api.example.com', {
  hooks: {
    beforeRetry: [
      async ({request, options, error, retryCount}) => {
        // Refresh token on 401
        if (error.response?.status === 401) {
          const token = await ky('https://api.example.com/refresh').text();
          request.headers.set('Authorization', `Bearer ${token}`);
        }
      }
    ]
  }
});
```

Hook receives:
- `request`: Request to be retried
- `options`: Normalized options
- `error`: Error that triggered retry (HTTPError or other)
- `retryCount`: Number of retries (>= 1)

Can return:
- `Request`: Replace retry request
- `Response`: Skip retry and use this response
- `ky.stop`: Abort retry (returns undefined response)

Stop retry by throwing error or returning `ky.stop`.

## afterResponse

Intercept and modify the response:

```js
const api = ky.extend({
  hooks: {
    afterResponse: [
      (_request, _options, response, {retryCount}) => {
        // Log responses
        console.log(`Response status: ${response.status}`);
        
        // Return modified response
        return new Response('Modified', {status: 200});
      },
      
      // Token refresh on 401
      async (request, _options, response, {retryCount}) => {
        if (response.status === 401 && retryCount === 0) {
          const {token} = await ky.post('https://api.example.com/refresh').json();
          
          const headers = new Headers(request.headers);
          headers.set('Authorization', `Bearer ${token}`);
          
          return ky.retry({
            request: new Request(request, {headers}),
            code: 'TOKEN_REFRESHED'
          });
        }
      }
    ]
  }
});
```

Hook receives:
- `request`: Normalized request
- `options`: Normalized options
- `response`: Clone of response
- `state`: Object with `retryCount`

Can return:
- `Response`: Replace response
- `ky.retry(options)`: Force retry with custom options
- `undefined`: Continue normally

## beforeError

Modify the error before it's thrown:

```js
await ky('https://api.example.com', {
  hooks: {
    beforeError: [
      async (error, {retryCount}) => {
        const {response} = error;
        if (response) {
          const body = await response.json();
          error.name = 'APIError';
          error.message = `${body.message} (${response.status})`;
        }
        
        // Add retry information
        if (retryCount > 0) {
          error.message += ` (after ${retryCount} retries)`;
        }
        
        return error;
      }
    ]
  }
});
```

Hook receives:
- `error`: HTTPError instance
- `state`: Object with `retryCount`

Must return the error instance.

## Force Retry from afterResponse

Use `ky.retry()` to retry based on response content:

```js
import ky, {isForceRetryError} from 'ky';

const api = ky.extend({
  hooks: {
    afterResponse: [
      async (request, options, response) => {
        if (response.status === 200) {
          const data = await response.clone().json();
          
          // Retry on business logic error
          if (data.error?.code === 'RATE_LIMIT') {
            return ky.retry({
              delay: data.error.retryAfter * 1000,
              code: 'RATE_LIMIT'
            });
          }
        }
      }
    ],
    beforeRetry: [
      ({error, retryCount}) => {
        if (isForceRetryError(error)) {
          console.log(`Forced retry #${retryCount}: ${error.message}`);
        }
      }
    ]
  }
});
```

`ky.retry()` options:
- `delay`: Custom delay in ms (bypasses jitter and backoffLimit)
- `code`: Error code for identification
- `cause`: Original error to preserve error chain
- `request`: Custom request for retry

<!--
源引用:
- https://github.com/sindresorhus/ky/blob/main/readme.md#hooks
- https://github.com/sindresorhus/ky/blob/main/readme.md#kyretryoptions
-->
