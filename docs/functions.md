# Functions

> **Note**\
> You need to register your application to unWallet Enterprise in advance.

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

> **Note**\
> You need to issue a transaction ticket via unWallet Enterprise API in advance.

```js
const result = await unWallet.sendTransaction({
  chainID: 80002,
  toAddress: "0xC2C747E0F7004F9E8817Db2ca4997657a7746928",
  value: "0xde0b6b3a7640000", // the amount of native token to be transferred
  ticket:
    "eyJhbGciOiJFUzI1NiIsImtpZCI6IjEiLCJ0eXAiOiJKV1QifQ.eyJhcGlDbGllbnRJRCI6IlFWQkpRMnhwWlc1ME9qRT0iLCJjaGFpbklEIjo4MDAwMiwiY2xpZW50SUQiOiJDWHFsSnBLWWlYTHpWdXEzbVU0OVVZNVVGbjJOM1VSVnQiLCJleHAiOjE3MTk0OTM3NzEsImlhdCI6MTcxOTQ5MzcxMSwiaWQiOiJkYjA1OTQ1MDI4MDQ4MWQ1ZjMxOWNlZWIwZTJkMjQ4MTNkNjc4OTdlODA1MGU1YTVmNWIyZWJkNzUxYmMwM2Y5IiwicGF5bWVudFR5cGUiOiJ1c2VyIiwidHJhbnNhY3Rpb25EYXRhIjoiMHgiLCJ0cmFuc2FjdGlvbkZyb21BZGRyZXNzIjoiMHgxMDVmNDMxMGIzRDE4RTNEN0YxOWZEN0RGNDg4NzM1YTE1MGVlZDJhIiwidHJhbnNhY3Rpb25Ub0FkZHJlc3MiOiIweEMyQzc0N0UwRjcwMDRGOUU4ODE3RGIyY2E0OTk3NjU3YTc3NDY5MjgiLCJ0cmFuc2FjdGlvblZhbHVlIjoiMHhkZTBiNmIzYTc2NDAwMDAifQ.LIzAe8Ar3c0KNWf0bczVUDodMj6pwwWngESC7AaWI9PHbmeQ6q3zsXgFJm__pi1mLJ79fHZfI0DF4fjreUDZtQ",
});
```

### Example result

```json
{
  "transactionID": "UXVldWVkVHJhbnNhY3Rpb246MQ=="
}
```

> **Note**\
> You can get the transaction detail via unWallet Enterprise API.
