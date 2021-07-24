# dauth-sdk-js

dAuth SDK for JavaScript

## Installation

```sh
$ npm i SIVIRA/dauth-sdk-js
```

## Example

To execute the sample codes below, you need to create an application with dAuth in advance.

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

### Requesting a signature for an message

```js
const sig = await dAuth.sign({
  message: "ARBITRARY_MESSAGE",
});
```
