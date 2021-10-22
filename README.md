# dauth-client-sdk-js

dAuth client-side SDK for JavaScript

:warning: dauth-client-sdk-js works fine only on browsers

## Installation

```sh
$ npm i dauth-client-sdk
```

## Example

To execute the sample codes below, you need to create an application with dAuth in advance.

### Initialization

```js
import { DAuth } from "dauth-client-sdk";

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

### Requesting a signature for a message

```js
const sig = await dAuth.sign({
  message: "ARBITRARY_MESSAGE",
});
```

### Requesting a signature for a token transfer transaction

```js
const metaTx = await dAuth.signTokenTransfer({
  id: 1, // token ID
  to: "0x0000000000000000000000000000000000000000", // destination address
  amount: 1, // token amount
});
```

To execute the transaction, call [POST /metaTransactions of dAuth API](https://developers.dauth.world/ja/latest/dauth-api.html#post-metatransactions).
