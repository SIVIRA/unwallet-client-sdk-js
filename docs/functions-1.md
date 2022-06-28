# Functions (for all developers)

> **Note**\
> To execute the sample codes below, you need to create an application with unWallet Enterprise in advance.

## authorize

`authorize` requests a user's ID token in accordance with OpenID Connect (response_type: id_token).

```js
unWallet.authorize({
  redirectURL: "http://your.app.com/callback",
  nonce: "pdITKAtep0pfPOrUXdzjqW6gKvXezurJ", // arbitrary string to prevent replay attacks
});
```

## sign

`sign` requests a signature for a message.

```js
const sig = await unWallet.sign({
  message: "ARBITRARY_MESSAGE",
});
```

### Example return value

```json
{
  "digest": "0xc71ed5b0509d8da72abc9527ed72530743822e8d9b33f9695b42e20ece78c09b",
  "signature": "0xd94388b5d51395c46b00f6197de318ba275cd7f9c5e4dccf2059373a4b41b3975403852e2587f262375e6d2b3318380dcd95535ecebec7e8c7ebbbefdcf22a371b"
}
```

### How to verify a signature

See also [ERC1271](https://eips.ethereum.org/EIPS/eip-1271).

```js
const ethers = require("ethers");

(async () => {
  const contract = new ethers.Contract(
    "<CONTRACT_WALLET_ADDRESS>",
    [
      {
        inputs: [
          {
            internalType: "bytes32",
            name: "hash",
            type: "bytes32",
          },
          {
            internalType: "bytes",
            name: "signature",
            type: "bytes",
          },
        ],
        name: "isValidSignature",
        outputs: [
          {
            internalType: "bytes4",
            name: "",
            type: "bytes4",
          },
        ],
        stateMutability: "view",
        type: "function",
      },
    ],
    new ethers.providers.JsonRpcProvider("<YOUR_RPC_URL>")
  );

  try {
    await contract.isValidSignature("<DIGEST>", "<SIGNATURE>");
  } catch (e) {
    console.log("invalid");
    return;
  }

  console.log("valid");
})();
```

## signTokenTransfer

`signTokenTransfer` requests a signature for a token transfer transaction.

```js
const metaTx = await unWallet.signTokenTransfer({
  id: 101, // token ID
  to: "0xB481148EB6A5f6b5b9Cc10cb0C8304B9B179A8e6", // destination address
  amount: 1, // token amount
});
```

### Example return value

```json
{
  "executor": "0x3ADBDCBa56d70Fc15Dcbe98901432cC07B2aAaeF",
  "data": "0x...",
  "signature": "0x19eb83842bc2d2c55567d4da63981ae9d4ce76ec567b591f18e18f4e030c4389331ba3ce0f1549331cb51710881320982b7b7a3632a7d81ca214690ecf3267c51c"
}
```

To execute the transaction, call [POST /metaTransactions of unWallet Enterprise API](https://developers.ent.unwallet.world/ja/latest/unwallet-ent-api.html#post-metatransactions).
