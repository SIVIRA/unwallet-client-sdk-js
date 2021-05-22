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

### Authorization

```js
dAuth.authorize({
  redirectURL: "http://your.domain.com/callback",
  nonce: "pdITKAtep0pfPOrUXdzjqW6gKvXezurJ", // arbitrary string to prevent replay attacks
});
```

### Request for signature

```js
const tx = await dAuth.createAssetTransferTransaction(
  "DESTINATION_ACCOUNT_NAME",
  1, // asset source ID
  "1 TOKEN" // quantity
);
```
