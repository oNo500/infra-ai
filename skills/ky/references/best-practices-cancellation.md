---
name: best-practices-cancellation
description: Request cancellation using AbortController
---

# Request Cancellation

Cancel in-flight requests using the standard AbortController API.

## Basic Cancellation

```js
import ky from 'ky';

const controller = new AbortController();
const {signal} = controller;

// Cancel after 5 seconds
setTimeout(() => {
  controller.abort();
}, 5000);

try {
  const response = await ky('https://api.example.com', {signal});
  const data = await response.json();
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Request was cancelled');
  } else {
    console.error('Request failed:', error);
  }
}
```

## React Component Example

```jsx
import {useEffect, useState} from 'react';
import ky from 'ky';

function UserProfile({userId}) {
  const [user, setUser] = useState(null);
  
  useEffect(() => {
    const controller = new AbortController();
    
    ky(`https://api.example.com/users/${userId}`, {
      signal: controller.signal
    })
      .json()
      .then(setUser)
      .catch(error => {
        if (error.name !== 'AbortError') {
          console.error(error);
        }
      });
    
    // Cleanup: cancel request when component unmounts
    return () => controller.abort();
  }, [userId]);
  
  return user ? <div>{user.name}</div> : <div>Loading...</div>;
}
```

## Multiple Request Cancellation

Use one AbortController for multiple requests:

```js
const controller = new AbortController();
const {signal} = controller;

const requests = [
  ky.get('https://api.example.com/users', {signal}),
  ky.get('https://api.example.com/posts', {signal}),
  ky.get('https://api.example.com/comments', {signal})
];

// Cancel all requests
setTimeout(() => controller.abort(), 3000);

try {
  const results = await Promise.all(requests.map(req => req.json()));
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('All requests cancelled');
  }
}
```

## Timeout vs Cancellation

Timeout is automatic cancellation after a duration:

```js
// Automatic timeout (built-in)
await ky('https://api.example.com', {
  timeout: 5000  // Throws TimeoutError after 5s
});

// Manual cancellation (user-controlled)
const controller = new AbortController();
await ky('https://api.example.com', {
  signal: controller.signal  // Throws AbortError when aborted
});
```

Use timeout for automatic failure, use AbortController for user-initiated cancellation.

<!--
源引用:
- https://github.com/sindresorhus/ky/blob/main/readme.md#cancellation
-->
