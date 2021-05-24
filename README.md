# dauth-sdk-js

dAuth SDK for JavaScript

## Installation

```sh
$ npm i ssh://git@github.com:SIVIRA/dauth-sdk-js.git
```

## Example

To execute the sample codes below, you need to create an "application" (client) with dAuth in advance.

### Initialization

```js
import { DAuth } from "dauth-sdk";

const dAuth = await DAuth.init({
  clientID: "CLIENT_ID_OF_YOUR_APPLICATION",
});
```

### Requesting a user's ID token in accordance with OpenID Connect (response_type: id_token)

```js
dAuth.authorize({
  redirectURL: "http://your.app.com/callback",
  nonce: "pdITKAtep0pfPOrUXdzjqW6gKvXezurJ", // arbitrary string to prevent replay attacks
});
```

This SDK only supports response_type: id_token, but dAuth also supports other response types. If you want to use other response types, please refer to [here](https://auth.manage-dev.dauth.world/.well-known/openid-configuration).

### Requesting a signature for an asset transfer transaction

```js
const tx = await dAuth.signTransaction({
  receiverID: "receiver1.pid",
  assetSourceID: 1,
  quantity: "1 TOKEN",
});
```

To broadcast the transaction to the blockchain, send it to the POST `/identities/<identityID>/transactions` endpoint of the [dAuth API](https://developers.dauth.world/ja/latest/dauth-api.html).
