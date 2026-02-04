---
name: feature-retry
description: Automatic retry mechanism with configurable strategies, delays, and custom logic
---

# Retry Mechanism

Ky automatically retries failed requests with intelligent defaults and extensive customization options.

## Default Behavior

Default retry configuration:
- `limit`: 2 retries
- `methods`: GET, PUT, HEAD, DELETE, OPTIONS, TRACE
- `statusCodes`: 408, 413, 429, 500, 502, 503, 504
- `afterStatusCodes`: 413, 429, 503 (respect Retry-After header)
- `delay`: Exponential backoff `0.3 * (2 ** (attemptCount - 1)) * 1000`

## Basic Configuration

```js
import ky from 'ky';

// Simple retry limit
const response = await ky('https://api.example.com', {
  retry: 5
});

// Detailed configuration
const response = await ky('https://api.example.com', {
  retry: {
    limit: 10,
    methods: ['get', 'post'],
    statusCodes: [413, 429, 503],
    backoffLimit: 3000
  }
});
```

## Retry on Timeout

By default, timeouts do NOT trigger retries. Enable with:

```js
const response = await ky('https://api.example.com', {
  timeout: 5000,
  retry: {
    limit: 3,
    retryOnTimeout: true
  }
});
```

## Jitter for Thundering Herd Prevention

Add randomness to retry delays to prevent simultaneous retries:

```js
const response = await ky('https://api.example.com', {
  retry: {
    limit: 5,
    
    // Full jitter (0 to computed delay)
    jitter: true,
    
    // Custom jitter function
    // jitter: delay => delay * (0.8 + Math.random() * 0.4)
  }
});
```

Note: Jitter is NOT applied when server provides `Retry-After` header.

## Custom Retry Logic

The `shouldRetry` function provides complete control over retry decisions:

```js
import ky, {HTTPError} from 'ky';

const response = await ky('https://api.example.com', {
  retry: {
    limit: 3,
    shouldRetry: ({error, retryCount}) => {
      if (error instanceof HTTPError) {
        const status = error.response.status;
        
        // Retry 429 only for first 2 attempts
        if (status === 429 && retryCount <= 2) {
          return true;
        }
        
        // Don't retry 4xx except rate limits
        if (status >= 400 && status < 500) {
          return false;
        }
      }
      
      // Use default retry logic for other cases
      return undefined;
    }
  }
});
```

`shouldRetry` return values:
- `true`: Force retry (bypasses all retry checks)
- `false`: Prevent retry
- `undefined`: Use default retry logic

## Retry-After Header Support

Ky automatically respects the `Retry-After` header for configured status codes:

```js
const response = await ky('https://api.example.com', {
  retry: {
    afterStatusCodes: [413, 429, 503],
    maxRetryAfter: 30000  // Max 30 seconds wait
  }
});
```

Falls back to `RateLimit-Reset` header if `Retry-After` is missing.

## Exponential Backoff

Customize the delay calculation:

```js
const response = await ky('https://api.example.com', {
  retry: {
    limit: 5,
    // Custom delay function
    delay: attemptCount => attemptCount * 1000,
    // Cap maximum delay
    backoffLimit: 5000
  }
});
```

<!--
源引用:
- https://github.com/sindresorhus/ky/blob/main/readme.md#retry
-->
