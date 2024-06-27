# unWallet client-side SDK

:warning: This SDK works correctly only on web browsers.

## Installation

```
npm install unwallet-client-sdk
```

## Initialization

```js
import { UnWallet } from "unwallet-client-sdk";

const unWallet = await UnWallet.init({
  clientID: "CLIENT_ID_OF_YOUR_APPLICATION",
});
```

## Usage

See [Functions](docs/functions.md).
