# dauth-sdk-js

dAuth SDK for JavaScript

## Installation

TODO

## Example

### Initialization

```js
import { DAuth } from "dauth-sdk-js";

const dAuth = await DAuth.init({
  clientID: "YOUR_CLIENT_ID",
});
```

### Requesting a user's ID token in accordance with OIDC (OpenID Connect)

```js
dAuth.authorize({
  redirectURL: "http://your.app.com/callback",
  nonce: "pdITKAtep0pfPOrUXdzjqW6gKvXezurJ", // arbitrary string to prevent replay attacks
});
```

### Requesting a signature for an asset transfer transaction

```js
const tx = await dAuth.signTransaction({
  receiverID: "receiver1.pid",
  assetSourceID: 1,
  quantity: "1 TOKEN",
});
```
