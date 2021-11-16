# unWallet client-side SDK

:warning: Works fine only on browsers

## Installation

```sh
$ npm install unwallet-client-sdk
```

## Example

To execute the sample codes below, you need to create an application with unWallet Enterprise in advance.

### Initialization

```js
import { UnWallet } from "unwallet-client-sdk";

const unWallet = await UnWallet.init({
  clientID: "CLIENT_ID_OF_YOUR_APPLICATION",
});
```

### Requesting a user's ID token in accordance with OpenID Connect (response_type: id_token)

```js
unWallet.authorize({
  redirectURL: "http://your.app.com/callback",
  nonce: "pdITKAtep0pfPOrUXdzjqW6gKvXezurJ", // arbitrary string to prevent replay attacks
});
```

### Requesting a signature for a message

```js
const sig = await unWallet.sign({
  message: "ARBITRARY_MESSAGE",
});
```

### Requesting a signature for a token transfer transaction

```js
const metaTx = await unWallet.signTokenTransfer({
  id: 1, // token ID
  to: "0x0000000000000000000000000000000000000000", // destination address
  amount: 1, // token amount
});
```

To execute the transaction, call [POST /metaTransactions of unWallet Enterprise API](https://developers.ent.unwallet.world/ja/latest/unwallet-ent-api.html#post-metatransactions).
