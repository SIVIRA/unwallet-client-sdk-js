# Functions (for web3 developers)

Use the following functions only if you want to work with your own contracts.

> **Note**\
> To execute the sample codes below, you need to create an application with unWallet Enterprise in advance.

## signTransaction

`signTransaction` requests a signature for a transaction.

```js
const metaTx = await unWallet.signTransaction({
  to: "0xB481148EB6A5f6b5b9Cc10cb0C8304B9B179A8e6", // the address the transaction is directed to
  value: "0x0", // the MATIC value sent with this transaction (optional)
  data: "0x...", // the hash of the invoked method signature and encoded parameters (optional)
});
```

:warning: You cannot specify parameters related to gas here because the gas consumed by the meta transaction is paid by the provider wallet.

### Example return value

```json
{
  "executor": "0x3ADBDCBa56d70Fc15Dcbe98901432cC07B2aAaeF",
  "data": "0x...",
  "signature": "0x19eb83842bc2d2c55567d4da63981ae9d4ce76ec567b591f18e18f4e030c4389331ba3ce0f1549331cb51710881320982b7b7a3632a7d81ca214690ecf3267c51c"
}
```

To execute the transaction, call [POST /metaTransactions of unWallet Enterprise API](https://developers.ent.unwallet.world/ja/latest/unwallet-ent-api.html#post-metatransactions).
