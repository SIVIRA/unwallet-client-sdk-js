# Functions

> **Note**\
> To execute the sample codes below, you need to create an application with unWallet Enterprise in advance.

## authorize

`authorize` requests a user's ID token in accordance with OpenID Connect (response_type: id_token).

### Example call

```js
unWallet.authorize({
  redirectURL: "http://your.app.com/callback",
  nonce: "ARBITRARY_STRING_TO_PREVENT_REPLAY_ATTACKS",
});
```

## sign

`sign` requests a signature for a message.

### Example call

```js
const result = await unWallet.sign({
  message: "ARBITRARY_MESSAGE",
});
```

### Example result

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

## sendTransaction

`sendTransaction` requests to send a transaction.

### Example call

```js
const result = await unWallet.sendTransaction({
  chainID: 137,
  toAddress: "0x0000000000000000000000000000000000000000",
  value: "0x1",
  ticket: "TODO",
});
```

### Example result

```json
{
  "transactionID": "UXVldWVkVHJhbnNhY3Rpb246MQ=="
}
```
