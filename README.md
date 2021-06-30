# dauth-sdk-js

dAuth SDK for JavaScript

## Installation

```sh
$ npm i SIVIRA/dauth-sdk-js
```

## Example

To execute the sample codes below, you need to create an "application" (client) with dAuth in advance.

### Initialization

```js
import { DAuth } from "dauth-sdk";

const dAuth = new DAuth({
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

### Requesting a signature for an message

```js
const sig = await dAuth.sign({
  message: "ARBITRARY_MESSAGE",
});
```
