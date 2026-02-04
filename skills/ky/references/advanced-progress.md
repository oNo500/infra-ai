---
name: advanced-progress
description: Upload and download progress tracking
---

# Progress Tracking

Monitor upload and download progress with event handlers.

## Download Progress

Track download progress with the `onDownloadProgress` callback:

```js
import ky from 'ky';

const response = await ky('https://example.com/large-file.zip', {
  onDownloadProgress: (progress, chunk) => {
    console.log(`${(progress.percent * 100).toFixed(2)}%`);
    console.log(`${progress.transferredBytes} / ${progress.totalBytes} bytes`);
    
    // chunk is Uint8Array (empty on first call)
  }
});
```

Progress object properties:
- `percent`: Number between 0 and 1
- `transferredBytes`: Bytes transferred so far
- `totalBytes`: Total bytes (may be 0 if unknown)

Chunk parameter:
- `Uint8Array` containing the data chunk
- Empty for the first call

## Upload Progress

Track upload progress with the `onUploadProgress` callback:

```js
import ky from 'ky';

const response = await ky.post('https://example.com/upload', {
  body: largeFile,
  onUploadProgress: (progress, chunk) => {
    const percent = (progress.percent * 100).toFixed(2);
    console.log(`Upload: ${percent}%`);
    console.log(`${progress.transferredBytes} / ${progress.totalBytes} bytes`);
    
    // chunk is Uint8Array (empty on last call)
  }
});
```

Chunk parameter:
- `Uint8Array` containing the data that was sent
- Empty for the last call

## Progress Bar Example

```js
let progressBar;

const response = await ky.post('https://example.com/upload', {
  body: formData,
  onUploadProgress: ({percent, transferredBytes, totalBytes}) => {
    // Update UI progress bar
    progressBar.style.width = `${percent * 100}%`;
    progressBar.textContent = `${transferredBytes} / ${totalBytes} bytes`;
  }
});
```

<!--
源引用:
- https://github.com/sindresorhus/ky/blob/main/readme.md#ondownloadprogress
- https://github.com/sindresorhus/ky/blob/main/readme.md#onuploadprogress
-->
