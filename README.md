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

#### Example return value

```json
{
  "digest": "0xc71ed5b0509d8da72abc9527ed72530743822e8d9b33f9695b42e20ece78c09b",
  "signature": "0xd94388b5d51395c46b00f6197de318ba275cd7f9c5e4dccf2059373a4b41b3975403852e2587f262375e6d2b3318380dcd95535ecebec7e8c7ebbbefdcf22a371b"
}
```

### Requesting a signature for a transaction

```js
const metaTx = await unWallet.signTransaction({
  to: "0xB481148EB6A5f6b5b9Cc10cb0C8304B9B179A8e6", // the address the transaction is directed to
  value: "0x0", // the MATIC value sent with this transaction (optional)
  data: "0x...", // the hash of the invoked method signature and encoded parameters (optional)
});
```

#### Example return value

```json
{
  "executor": "0x3ADBDCBa56d70Fc15Dcbe98901432cC07B2aAaeF",
  "data": "0x...",
  "signature": "0x19eb83842bc2d2c55567d4da63981ae9d4ce76ec567b591f18e18f4e030c4389331ba3ce0f1549331cb51710881320982b7b7a3632a7d81ca214690ecf3267c51c"
}
```

To execute the transaction, call [POST /metaTransactions of unWallet Enterprise API](https://developers.ent.unwallet.world/ja/latest/unwallet-ent-api.html#post-metatransactions).

### Requesting a signature for a token transfer transaction

```js
const metaTx = await unWallet.signTokenTransfer({
  id: 101, // token ID
  to: "0xB481148EB6A5f6b5b9Cc10cb0C8304B9B179A8e6", // destination address
  amount: 1, // token amount
});
```

#### Example return value

```json
{
  "executor": "0x3ADBDCBa56d70Fc15Dcbe98901432cC07B2aAaeF",
  "data": "0x...",
  "signature": "0x19eb83842bc2d2c55567d4da63981ae9d4ce76ec567b591f18e18f4e030c4389331ba3ce0f1549331cb51710881320982b7b7a3632a7d81ca214690ecf3267c51c"
}
```

To execute the transaction, call [POST /metaTransactions of unWallet Enterprise API](https://developers.ent.unwallet.world/ja/latest/unwallet-ent-api.html#post-metatransactions).
