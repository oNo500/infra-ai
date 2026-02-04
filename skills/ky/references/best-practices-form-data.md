---
name: best-practices-form-data
description: Sending form data including multipart/form-data and application/x-www-form-urlencoded
---

# Sending Form Data

Handle form submissions with different encoding types.

## Multipart Form Data

Send `multipart/form-data` with FormData:

```js
import ky from 'ky';

const formData = new FormData();
formData.append('name', 'John Doe');
formData.append('email', 'john@example.com');
formData.append('avatar', fileInput.files[0]);

const response = await ky.post('https://api.example.com/upload', {
  body: formData
});
```

The `Content-Type` header is automatically set to `multipart/form-data` with the correct boundary.

## URL-Encoded Form Data

Send `application/x-www-form-urlencoded` with URLSearchParams:

```js
import ky from 'ky';

const searchParams = new URLSearchParams();
searchParams.set('username', 'john');
searchParams.set('password', 'secret');

const response = await ky.post('https://api.example.com/login', {
  body: searchParams
});
```

The `Content-Type` header is automatically set to `application/x-www-form-urlencoded`.

## Modifying FormData in Hooks

When modifying FormData in hooks, delete the `Content-Type` header to let the browser regenerate it with the correct boundary:

```js
import ky from 'ky';

const response = await ky.post('https://api.example.com/upload', {
  body: formData,
  hooks: {
    beforeRequest: [
      request => {
        const newFormData = new FormData();
        
        // Transform field names to lowercase
        for (const [key, value] of formData) {
          newFormData.set(key.toLowerCase(), value);
        }
        
        // Delete Content-Type to trigger regeneration
        request.headers.delete('content-type');
        
        return new Request(request, {body: newFormData});
      }
    ]
  }
});
```

This is necessary because the boundary parameter in `Content-Type` must match the FormData instance.

## File Upload with Progress

```js
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('description', 'My file');

const response = await ky.post('https://api.example.com/upload', {
  body: formData,
  onUploadProgress: (progress) => {
    const percent = (progress.percent * 100).toFixed(2);
    console.log(`Upload progress: ${percent}%`);
  }
});
```

## Custom Content-Type

For non-standard content types required by specific APIs:

```js
const response = await ky.post('https://api.example.com', {
  headers: {
    'content-type': 'application/x-amz-json-1.1'
  },
  json: {foo: 'bar'}
});
```

<!--
源引用:
- https://github.com/sindresorhus/ky/blob/main/readme.md#sending-form-data
- https://github.com/sindresorhus/ky/blob/main/readme.md#setting-a-custom-content-type
-->
