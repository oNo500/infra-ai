---
name: best-practices-nodejs
description: Node.js specific features including proxy support and HTTP/2
---

# Node.js Specific Features

Advanced features for Node.js environments including proxy and HTTP/2 support.

## Native Proxy Support (Node.js 24.5+)

Use environment variables for automatic proxy configuration:

```sh
NODE_USE_ENV_PROXY=1 HTTP_PROXY=http://proxy.example.com:8080 node app.js
```

Or with CLI flag:

```sh
node --use-env-proxy app.js
```

Environment variables:
- `HTTP_PROXY` / `http_proxy`: Proxy for HTTP requests
- `HTTPS_PROXY` / `https_proxy`: Proxy for HTTPS requests
- `NO_PROXY` / `no_proxy`: Comma-separated list of hosts to bypass

## ProxyAgent

For more control over proxy configuration:

```js
import ky from 'ky';
import {ProxyAgent} from 'undici';

const proxyAgent = new ProxyAgent('http://proxy.example.com:8080');

const response = await ky('https://api.example.com', {
  // @ts-expect-error - dispatcher not in type definition
  dispatcher: proxyAgent
}).json();
```

## EnvHttpProxyAgent

Automatically read proxy settings from environment variables:

```js
import ky from 'ky';
import {EnvHttpProxyAgent} from 'undici';

const proxyAgent = new EnvHttpProxyAgent();

const api = ky.extend({
  // @ts-expect-error - dispatcher not in type definition
  dispatcher: proxyAgent
});

const response = await api('https://api.example.com').json();
```

## HTTP/2 Support

Enable HTTP/2 with custom dispatcher:

```js
import ky from 'ky';
import {Agent, Pool} from 'undici';

const agent = new Agent({
  factory(origin, options) {
    return new Pool(origin, {
      ...options,
      allowH2: true
    });
  }
});

const response = await ky('https://api.example.com', {
  // @ts-expect-error - dispatcher not in type definition
  dispatcher: agent
}).json();
```

## Combining Proxy and HTTP/2

```js
import ky from 'ky';
import {ProxyAgent} from 'undici';

const proxyAgent = new ProxyAgent({
  uri: 'http://proxy.example.com:8080',
  allowH2: true
});

const response = await ky('https://api.example.com', {
  // @ts-expect-error - dispatcher not in type definition
  dispatcher: proxyAgent
}).json();
```

## Reusable Instances

Create a reusable instance with proxy/HTTP2 configuration:

```js
import ky from 'ky';
import {EnvHttpProxyAgent} from 'undici';
import {Agent, Pool} from 'undici';

const h2Agent = new Agent({
  factory(origin, options) {
    return new Pool(origin, {...options, allowH2: true});
  }
});

const api = ky.create({
  // @ts-expect-error
  dispatcher: h2Agent,
  prefixUrl: 'https://api.example.com'
});

export default api;
```

<!--
源引用:
- https://github.com/sindresorhus/ky/blob/main/readme.md#proxy-support-nodejs
- https://github.com/sindresorhus/ky/blob/main/readme.md#http2-support-nodejs
-->
