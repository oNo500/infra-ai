---
name: feature-errors
description: Error handling with HTTPError, TimeoutError, and custom error types
---

# Error Handling

Ky provides structured error types and control over error throwing behavior.

## HTTPError

Thrown when response has non-2xx status code (after following redirects):

```js
import {isHTTPError} from 'ky';

try {
  await ky('https://api.example.com/users').json();
} catch (error) {
  if (isHTTPError(error)) {
    console.log(error.response.status);  // e.g., 404
    console.log(error.request.url);      // Request URL
    console.log(error.options);          // Normalized options
    
    // Read error response body
    const errorData = await error.response.json();
  }
}
```

HTTPError properties:
- `response`: Response object
- `request`: Request object
- `options`: Normalized options

**Important**: Always consume or cancel `error.response.body` to prevent resource leaks:

```js
try {
  await ky('https://api.example.com').json();
} catch (error) {
  if (isHTTPError(error)) {
    // Option 1: Read the body
    const errorJson = await error.response.json();
    
    // Option 2: Cancel if not needed
    // await error.response.body?.cancel();
  }
}
```

## TimeoutError

Thrown when request exceeds the timeout:

```js
import {isTimeoutError} from 'ky';

try {
  await ky('https://api.example.com', {timeout: 1000});
} catch (error) {
  if (isTimeoutError(error)) {
    console.log('Request timed out');
    console.log(error.request.url);
  }
}
```

TimeoutError properties:
- `request`: Request object

## ForceRetryError

Thrown internally when using `ky.retry()` in hooks:

```js
import {isForceRetryError} from 'ky';

const api = ky.extend({
  hooks: {
    beforeRetry: [
      ({error, retryCount}) => {
        if (isForceRetryError(error)) {
          console.log(`Forced retry #${retryCount}: ${error.message}`);
          // Example: "Forced retry: RATE_LIMIT"
        }
      }
    ]
  }
});
```

## throwHttpErrors

Control whether to throw on non-2xx responses:

```js
// Disable error throwing
const response = await ky('https://api.example.com', {
  throwHttpErrors: false
});

if (!response.ok) {
  // Handle error manually
}
```

Function form for selective error handling:

```js
const response = await ky('https://api.example.com', {
  throwHttpErrors: (status) => {
    // Don't throw on 404
    return status !== 404;
  }
});
```

Note: When `throwHttpErrors: false`, error responses are considered successful and the request will NOT be retried.

## beforeError Hook

Modify errors before they're thrown:

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
        
        if (retryCount > 0) {
          error.message += ` (failed after ${retryCount} retries)`;
        }
        
        return error;
      }
    ]
  }
});
```

## Type Guards

Use type guards to check error types:

```js
import {isKyError, isHTTPError, isTimeoutError, isForceRetryError} from 'ky';

try {
  await ky('https://api.example.com');
} catch (error) {
  if (isKyError(error)) {
    // Any Ky-specific error
  }
  
  if (isHTTPError(error)) {
    // HTTP error (non-2xx status)
  }
  
  if (isTimeoutError(error)) {
    // Timeout error
  }
  
  if (isForceRetryError(error)) {
    // Force retry error (used internally)
  }
}
```

## Error Handling Patterns

### API-Specific Errors

```js
class APIError extends Error {
  constructor(message, response) {
    super(message);
    this.name = 'APIError';
    this.response = response;
  }
}

const api = ky.extend({
  hooks: {
    beforeError: [
      async (error) => {
        if (error.response) {
          const {message, code} = await error.response.json();
          throw new APIError(`${code}: ${message}`, error.response);
        }
        return error;
      }
    ]
  }
});
```

### Retry with Different Error Handling

```js
const response = await ky('https://api.example.com', {
  retry: {
    shouldRetry: ({error}) => {
      // Don't retry on 4xx client errors
      if (isHTTPError(error) && error.response.status >= 400 && error.response.status < 500) {
        return false;
      }
      return undefined; // Use default retry logic
    }
  }
});
```

<!--
源引用:
- https://github.com/sindresorhus/ky/blob/main/readme.md#httperror
- https://github.com/sindresorhus/ky/blob/main/readme.md#timeouterror
- https://github.com/sindresorhus/ky/blob/main/readme.md#throwhttperrors
-->
