import {
  Address,
  ByteArray,
  Hex,
  hashTypedData,
  parseEther,
  sha256,
  toBytes,
  toHex,
} from "viem";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { z } from "zod";

import { getUnWalletConfigByEnv } from "./config";
import { EIP712TypedData } from "./eip712";
import { UWError } from "./error";
import {
  base64URLEncode,
  mockXAPI,
  randomBytes,
  randomBytesHex,
} from "./testutil";
import { SendTransactionResult, SignResult, UnWallet } from "./unwallet";
import { XResponse } from "./x";

const env = "dev";
const uwConfig = getUnWalletConfigByEnv(env);

const dummy = ((): {
  xConnID: string;

  clientID: string;
  redirectURL: URL;
  nonce: string;

  chainID: number;

  msg: string;
  msgDigest: Hex;

  eip712TypedData: EIP712TypedData;
  eip712TypedDataDigest: Hex;

  ticketToken: string;

  sig: Hex;

  txID: string;
  txToAddress: Address;
  txValue: bigint;
  txData: ByteArray;
} => {
  const msg = "message to be signed";

  // from https://eips.ethereum.org/assets/eip-712/Example.js
  const eip712TypedData: EIP712TypedData = {
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" },
      ],
      Person: [
        { name: "name", type: "string" },
        { name: "wallet", type: "address" },
      ],
      Mail: [
        { name: "from", type: "Person" },
        { name: "to", type: "Person" },
        { name: "contents", type: "string" },
      ],
    },
    primaryType: "Mail",
    domain: {
      name: "Ether Mail",
      version: "1",
      chainId: 1,
      verifyingContract: "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC",
    },
    message: {
      from: {
        name: "Cow",
        wallet: "0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826",
      },
      to: {
        name: "Bob",
        wallet: "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB",
      },
      contents: "Hello, Bob!",
    },
  };

  return {
    xConnID: "xconn",

    clientID: "C00000000000000000000000000000001",
    redirectURL: new URL("https://example.com/callback"),
    nonce: randomBytesHex(32),

    chainID: 1,

    msg,
    msgDigest: sha256(toBytes(msg)),

    eip712TypedData,
    eip712TypedDataDigest: hashTypedData(eip712TypedData),

    ticketToken: randomBytesHex(32),

    sig: randomBytesHex(65),

    txID: base64URLEncode("Transaction:1"),
    txToAddress: "0x0000000000000000000000000000000000000001",
    txValue: parseEther("1"),
    txData: randomBytes(32),
  };
})();

const locationMock = {
  assign: vi.fn(),
};
const screenMock = {
  width: 1920,
  height: 1080,
};
const windowMock = {
  open: vi.fn(),
};
const xAPIMock = mockXAPI(uwConfig.xAPI.url, {
  handlers: {
    getConnectionID: (args) =>
      args.client.send(
        JSON.stringify({
          type: "connectionID",
          value: dummy.xConnID,
        } satisfies XResponse),
      ),
  },
});

beforeAll(() =>
  xAPIMock.server.listen({
    onUnhandledRequest: "error", // prevent unhandled requests from passing through to the real server
  }),
);
beforeEach(() => {
  vi.stubGlobal("location", locationMock);
  vi.stubGlobal("screen", screenMock);
  vi.stubGlobal("window", windowMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();

  xAPIMock.server.resetHandlers();
  xAPIMock.closeClient();
});
afterAll(() => xAPIMock.server.close());

describe("UnWallet", () => {
  describe("authorize", () => {
    it("redirects to the virtual authorization page: with default options", async () => {
      const uw = await UnWallet.init({
        env,
        clientID: dummy.clientID,
      });

      uw.authorize({
        redirectURL: dummy.redirectURL.toString(),
      });

      expect(locationMock.assign).toHaveBeenCalledTimes(1);

      let destURL: URL;
      {
        const result = safeParseAssignedLocationURLInMockCalls();
        if (!result.success) {
          expect.fail(z.prettifyError(result.error));
        }

        destURL = result.data;
      }
      expect(destURL.origin + destURL.pathname).toBe(
        new URL("/vauthorize", uwConfig.frontend.origin).toString(),
      );
      expect(Object.fromEntries(destURL.searchParams)).toEqual({
        response_type: "id_token",
        response_mode: "fragment",
        client_id: dummy.clientID,
        scope: "openid",
        redirect_uri: dummy.redirectURL.toString(),
      });
    });

    it("redirects to the authorization page: with all options", async () => {
      const responseMode = "form_post";

      const uw = await UnWallet.init({
        env,
        clientID: dummy.clientID,
      });

      uw.authorize({
        responseMode,
        redirectURL: dummy.redirectURL.toString(),
        nonce: dummy.nonce,
        isVirtual: false,
        chainID: dummy.chainID,
      });

      expect(locationMock.assign).toHaveBeenCalledTimes(1);

      let destURL: URL;
      {
        const result = safeParseAssignedLocationURLInMockCalls();
        if (!result.success) {
          expect.fail(z.prettifyError(result.error));
        }

        destURL = result.data;
      }
      expect(destURL.origin + destURL.pathname).toBe(
        new URL("/authorize", uwConfig.frontend.origin).toString(),
      );
      expect(Object.fromEntries(destURL.searchParams)).toEqual({
        response_type: "id_token",
        response_mode: responseMode,
        client_id: dummy.clientID,
        scope: "openid",
        redirect_uri: dummy.redirectURL.toString(),
        nonce: dummy.nonce,
        chain_id: dummy.chainID.toString(),
      });
    });
  });

  describe("sign", () => {
    it("resolves the first request, then accepts the second request", async () => {
      const uw = await UnWallet.init({
        env,
        clientID: dummy.clientID,
      });

      const waitToSign = uw.sign({
        message: dummy.msg,
        ticketToken: dummy.ticketToken,
      });

      expect(windowMock.open).toHaveBeenCalledTimes(1);

      {
        let windowURL: URL;
        {
          const result = safeParseOpenedWindowURLInMockCalls(0);
          if (!result.success) {
            expect.fail(z.prettifyError(result.error));
          }

          windowURL = result.data;
        }
        expect(windowURL.origin + windowURL.pathname).toBe(
          new URL("/x/sign", uwConfig.frontend.origin).toString(),
        );
        expect(Object.fromEntries(windowURL.searchParams)).toEqual({
          connectionID: dummy.xConnID,
          clientID: dummy.clientID,
          message: dummy.msg,
          ticketToken: dummy.ticketToken,
        });
      }

      xAPIMock.sendToClient(
        JSON.stringify({
          type: "signature",
          value: dummy.sig,
        } satisfies XResponse),
      );

      await expect(waitToSign).resolves.toEqual({
        digest: dummy.msgDigest,
        signature: dummy.sig,
      } satisfies SignResult);

      const waitToSignAgain = uw.sign({
        message: dummy.msg,
        ticketToken: dummy.ticketToken,
      });

      expect(windowMock.open).toHaveBeenCalledTimes(2);

      {
        let windowURL: URL;
        {
          const result = safeParseOpenedWindowURLInMockCalls(1);
          if (!result.success) {
            expect.fail(z.prettifyError(result.error));
          }

          windowURL = result.data;
        }
        expect(windowURL.origin + windowURL.pathname).toBe(
          new URL("/x/sign", uwConfig.frontend.origin).toString(),
        );
        expect(Object.fromEntries(windowURL.searchParams)).toEqual({
          connectionID: dummy.xConnID,
          clientID: dummy.clientID,
          message: dummy.msg,
          ticketToken: dummy.ticketToken,
        });
      }

      xAPIMock.sendToClient(
        JSON.stringify({
          type: "signature",
          value: dummy.sig,
        } satisfies XResponse),
      );

      await expect(waitToSignAgain).resolves.toEqual({
        digest: dummy.msgDigest,
        signature: dummy.sig,
      } satisfies SignResult);
    });

    it("rejects on an unopened connection", async () => {
      const uw = await UnWallet.init({
        env,
        clientID: dummy.clientID,
      });

      uw.close();

      const waitToSign = uw.sign({
        message: dummy.msg,
        ticketToken: dummy.ticketToken,
      });

      expect(windowMock.open).not.toHaveBeenCalled();

      await expect(waitToSign).rejects.toThrow(
        new UWError("CONNECTION_NOT_OPENED"),
      );
    });

    it("rejects on a request in progress", async () => {
      const uw = await UnWallet.init({
        env,
        clientID: dummy.clientID,
      });

      const waitToSign = uw.sign({
        message: dummy.msg,
        ticketToken: dummy.ticketToken,
      });

      expect(windowMock.open).toHaveBeenCalledTimes(1);

      const waitToSignAgain = uw.sign({
        message: dummy.msg,
        ticketToken: dummy.ticketToken,
      });

      expect(windowMock.open).toHaveBeenCalledTimes(1);

      await expect(waitToSignAgain).rejects.toThrow(
        new UWError("REQUEST_IN_PROGRESS"),
      );

      uw.close();

      await expect(waitToSign).rejects.toThrow(
        new UWError("CONNECTION_CLOSED"),
      );
    });

    it("rejects on an invalid response: unexpected type: transaction id", async () => {
      const uw = await UnWallet.init({
        env,
        clientID: dummy.clientID,
      });

      const waitToSign = uw.sign({
        message: dummy.msg,
        ticketToken: dummy.ticketToken,
      });

      expect(windowMock.open).toHaveBeenCalledTimes(1);

      xAPIMock.sendToClient(
        JSON.stringify({
          type: "transactionID",
          value: dummy.txID,
        } satisfies XResponse),
      );

      await expect(waitToSign).rejects.toThrow(
        new UWError("INVALID_RESPONSE", "unexpected type: transactionID"),
      );
    });

    it("rejects the first request, then accepts the second request", async () => {
      const uw = await UnWallet.init({
        env,
        clientID: dummy.clientID,
      });

      const waitToSign = uw.sign({
        message: dummy.msg,
        ticketToken: dummy.ticketToken,
      });

      expect(windowMock.open).toHaveBeenCalledTimes(1);

      xAPIMock.sendToClient(
        JSON.stringify({
          type: "error",
          value: "rejected",
        } satisfies XResponse),
      );

      await expect(waitToSign).rejects.toThrow(new UWError("REQUEST_REJECTED"));

      const waitToSignAgain = uw.sign({
        message: dummy.msg,
        ticketToken: dummy.ticketToken,
      });

      expect(windowMock.open).toHaveBeenCalledTimes(2);

      xAPIMock.sendToClient(
        JSON.stringify({
          type: "signature",
          value: dummy.sig,
        } satisfies XResponse),
      );

      await expect(waitToSignAgain).resolves.toEqual({
        digest: dummy.msgDigest,
        signature: dummy.sig,
      } satisfies SignResult);
    });
  });

  describe("signEIP712TypedData", () => {
    it("resolves the first request, then accepts the second request", async () => {
      const uw = await UnWallet.init({
        env,
        clientID: dummy.clientID,
      });

      const waitToSignEIP712TypedData = uw.signEIP712TypedData({
        typedData: dummy.eip712TypedData,
        ticketToken: dummy.ticketToken,
      });

      expect(windowMock.open).toHaveBeenCalledTimes(1);

      {
        let windowURL: URL;
        {
          const result = safeParseOpenedWindowURLInMockCalls(0);
          if (!result.success) {
            expect.fail(z.prettifyError(result.error));
          }

          windowURL = result.data;
        }
        expect(windowURL.origin + windowURL.pathname).toBe(
          new URL(
            "/x/signEIP712TypedData",
            uwConfig.frontend.origin,
          ).toString(),
        );
        expect(Object.fromEntries(windowURL.searchParams)).toEqual({
          connectionID: dummy.xConnID,
          clientID: dummy.clientID,
          typedData: JSON.stringify(dummy.eip712TypedData),
          ticketToken: dummy.ticketToken,
        });

        xAPIMock.sendToClient(
          JSON.stringify({
            type: "signature",
            value: dummy.sig,
          } satisfies XResponse),
        );
      }

      await expect(waitToSignEIP712TypedData).resolves.toEqual({
        digest: dummy.eip712TypedDataDigest,
        signature: dummy.sig,
      } satisfies SignResult);

      const waitToSignEIP712TypedDataAgain = uw.signEIP712TypedData({
        typedData: dummy.eip712TypedData,
        ticketToken: dummy.ticketToken,
      });

      expect(windowMock.open).toHaveBeenCalledTimes(2);

      {
        let windowURL: URL;
        {
          const result = safeParseOpenedWindowURLInMockCalls(1);
          if (!result.success) {
            expect.fail(z.prettifyError(result.error));
          }

          windowURL = result.data;
        }
        expect(windowURL.origin + windowURL.pathname).toBe(
          new URL(
            "/x/signEIP712TypedData",
            uwConfig.frontend.origin,
          ).toString(),
        );
        expect(Object.fromEntries(windowURL.searchParams)).toEqual({
          connectionID: dummy.xConnID,
          clientID: dummy.clientID,
          typedData: JSON.stringify(dummy.eip712TypedData),
          ticketToken: dummy.ticketToken,
        });

        xAPIMock.sendToClient(
          JSON.stringify({
            type: "signature",
            value: dummy.sig,
          } satisfies XResponse),
        );
      }

      xAPIMock.sendToClient(
        JSON.stringify({
          type: "signature",
          value: dummy.sig,
        } satisfies XResponse),
      );

      await expect(waitToSignEIP712TypedDataAgain).resolves.toEqual({
        digest: dummy.eip712TypedDataDigest,
        signature: dummy.sig,
      } satisfies SignResult);
    });

    it("rejects on an invalid request: invalid typed data", async () => {
      const uw = await UnWallet.init({
        env,
        clientID: dummy.clientID,
      });

      const waitToSignEIP712TypedData = uw.signEIP712TypedData({
        typedData: {
          ...dummy.eip712TypedData,
          primaryType: "InvalidPrimaryType",
        },
        ticketToken: dummy.ticketToken,
      });

      expect(windowMock.open).not.toHaveBeenCalled();

      await expect(waitToSignEIP712TypedData).rejects.toThrow(
        new UWError(
          "INVALID_REQUEST",
          'invalid typed data: Invalid primary type `InvalidPrimaryType` must be one of `["Person","Mail"]`.',
        ),
      );
    });

    it("rejects on an unopened connection", async () => {
      const uw = await UnWallet.init({
        env,
        clientID: dummy.clientID,
      });

      uw.close();

      const waitToSignEIP712TypedData = uw.signEIP712TypedData({
        typedData: dummy.eip712TypedData,
        ticketToken: dummy.ticketToken,
      });

      expect(windowMock.open).not.toHaveBeenCalled();

      await expect(waitToSignEIP712TypedData).rejects.toThrow(
        new UWError("CONNECTION_NOT_OPENED"),
      );
    });

    it("rejects on a request in progress", async () => {
      const uw = await UnWallet.init({
        env,
        clientID: dummy.clientID,
      });

      const waitToSignEIP712TypedData = uw.signEIP712TypedData({
        typedData: dummy.eip712TypedData,
        ticketToken: dummy.ticketToken,
      });

      expect(windowMock.open).toHaveBeenCalledTimes(1);

      const waitToSignEIP712TypedDataAgain = uw.signEIP712TypedData({
        typedData: dummy.eip712TypedData,
        ticketToken: dummy.ticketToken,
      });

      expect(windowMock.open).toHaveBeenCalledTimes(1);

      await expect(waitToSignEIP712TypedDataAgain).rejects.toThrow(
        new UWError("REQUEST_IN_PROGRESS"),
      );

      uw.close();

      await expect(waitToSignEIP712TypedData).rejects.toThrow(
        new UWError("CONNECTION_CLOSED"),
      );
    });

    it("rejects on an invalid response: unexpected type: transaction id", async () => {
      const uw = await UnWallet.init({
        env,
        clientID: dummy.clientID,
      });

      const waitToSignEIP712TypedData = uw.signEIP712TypedData({
        typedData: dummy.eip712TypedData,
        ticketToken: dummy.ticketToken,
      });

      expect(windowMock.open).toHaveBeenCalledTimes(1);

      xAPIMock.sendToClient(
        JSON.stringify({
          type: "transactionID",
          value: dummy.txID,
        } satisfies XResponse),
      );

      await expect(waitToSignEIP712TypedData).rejects.toThrow(
        new UWError("INVALID_RESPONSE", "unexpected type: transactionID"),
      );
    });

    it("rejects the first request, then accepts the second request", async () => {
      const uw = await UnWallet.init({
        env,
        clientID: dummy.clientID,
      });

      const waitToSignEIP712TypedData = uw.signEIP712TypedData({
        typedData: dummy.eip712TypedData,
        ticketToken: dummy.ticketToken,
      });

      expect(windowMock.open).toHaveBeenCalledTimes(1);

      xAPIMock.sendToClient(
        JSON.stringify({
          type: "error",
          value: "rejected",
        } satisfies XResponse),
      );

      await expect(waitToSignEIP712TypedData).rejects.toThrow(
        new UWError("REQUEST_REJECTED"),
      );

      const waitToSignEIP712TypedDataAgain = uw.signEIP712TypedData({
        typedData: dummy.eip712TypedData,
        ticketToken: dummy.ticketToken,
      });

      expect(windowMock.open).toHaveBeenCalledTimes(2);

      xAPIMock.sendToClient(
        JSON.stringify({
          type: "signature",
          value: dummy.sig,
        } satisfies XResponse),
      );

      await expect(waitToSignEIP712TypedDataAgain).resolves.toEqual({
        digest: dummy.eip712TypedDataDigest,
        signature: dummy.sig,
      } satisfies SignResult);
    });
  });

  describe("sendTransaction", () => {
    it("resolves the first request, then accepts the second request", async () => {
      const uw = await UnWallet.init({
        env,
        clientID: dummy.clientID,
      });

      const waitToSendTransaction = uw.sendTransaction({
        chainID: dummy.chainID,
        toAddress: dummy.txToAddress,
        value: toHex(dummy.txValue),
        ticketToken: dummy.ticketToken,
      });

      expect(windowMock.open).toHaveBeenCalledTimes(1);

      {
        let windowURL: URL;
        {
          const result = safeParseOpenedWindowURLInMockCalls(0);
          if (!result.success) {
            expect.fail(z.prettifyError(result.error));
          }

          windowURL = result.data;
        }
        expect(windowURL.origin + windowURL.pathname).toBe(
          new URL("/x/sendTransaction", uwConfig.frontend.origin).toString(),
        );
        expect(Object.fromEntries(windowURL.searchParams)).toEqual({
          connectionID: dummy.xConnID,
          clientID: dummy.clientID,
          chainID: dummy.chainID.toString(),
          toAddress: dummy.txToAddress,
          value: toHex(dummy.txValue),
          data: "0x",
          ticketToken: dummy.ticketToken,
        });
      }

      xAPIMock.sendToClient(
        JSON.stringify({
          type: "transactionID",
          value: dummy.txID,
        } satisfies XResponse),
      );

      await expect(waitToSendTransaction).resolves.toEqual({
        transactionID: dummy.txID,
      } satisfies SendTransactionResult);

      const waitToSendTransactionAgain = uw.sendTransaction({
        chainID: dummy.chainID,
        toAddress: dummy.txToAddress,
        data: toHex(dummy.txData),
        ticketToken: dummy.ticketToken,
      });

      expect(windowMock.open).toHaveBeenCalledTimes(2);

      {
        let windowURL: URL;
        {
          const result = safeParseOpenedWindowURLInMockCalls(1);
          if (!result.success) {
            expect.fail(z.prettifyError(result.error));
          }

          windowURL = result.data;
        }
        expect(windowURL.origin + windowURL.pathname).toBe(
          new URL("/x/sendTransaction", uwConfig.frontend.origin).toString(),
        );
        expect(Object.fromEntries(windowURL.searchParams)).toEqual({
          connectionID: dummy.xConnID,
          clientID: dummy.clientID,
          chainID: dummy.chainID.toString(),
          toAddress: dummy.txToAddress,
          value: "0x0",
          data: toHex(dummy.txData),
          ticketToken: dummy.ticketToken,
        });
      }

      xAPIMock.sendToClient(
        JSON.stringify({
          type: "transactionID",
          value: dummy.txID,
        } satisfies XResponse),
      );

      await expect(waitToSendTransactionAgain).resolves.toEqual({
        transactionID: dummy.txID,
      } satisfies SendTransactionResult);
    });

    it("rejects on an invalid request: either value or data is required", async () => {
      const uw = await UnWallet.init({
        env,
        clientID: dummy.clientID,
      });

      const waitToSendTransaction = uw.sendTransaction({
        chainID: dummy.chainID,
        toAddress: dummy.txToAddress,
        ticketToken: dummy.ticketToken,
      });

      expect(windowMock.open).not.toHaveBeenCalled();

      await expect(waitToSendTransaction).rejects.toThrow(
        new UWError("INVALID_REQUEST", "either value or data is required"),
      );
    });

    it("rejects on an unopened connection", async () => {
      const uw = await UnWallet.init({
        env,
        clientID: dummy.clientID,
      });

      uw.close();

      const waitToSendTransaction = uw.sendTransaction({
        chainID: dummy.chainID,
        toAddress: dummy.txToAddress,
        value: toHex(dummy.txValue),
        ticketToken: dummy.ticketToken,
      });

      expect(windowMock.open).not.toHaveBeenCalled();

      await expect(waitToSendTransaction).rejects.toThrow(
        new UWError("CONNECTION_NOT_OPENED"),
      );
    });

    it("rejects on a request in progress", async () => {
      const uw = await UnWallet.init({
        env,
        clientID: dummy.clientID,
      });

      const waitToSendTransaction = uw.sendTransaction({
        chainID: dummy.chainID,
        toAddress: dummy.txToAddress,
        value: toHex(dummy.txValue),
        ticketToken: dummy.ticketToken,
      });

      expect(windowMock.open).toHaveBeenCalledTimes(1);

      const waitToSendTransactionAgain = uw.sendTransaction({
        chainID: dummy.chainID,
        toAddress: dummy.txToAddress,
        data: toHex(dummy.txData),
        ticketToken: dummy.ticketToken,
      });

      expect(windowMock.open).toHaveBeenCalledTimes(1);

      await expect(waitToSendTransactionAgain).rejects.toThrow(
        new UWError("REQUEST_IN_PROGRESS"),
      );

      uw.close();

      await expect(waitToSendTransaction).rejects.toThrow(
        new UWError("CONNECTION_CLOSED"),
      );
    });

    it("rejects on an invalid response: unexpected type: signature", async () => {
      const uw = await UnWallet.init({
        env,
        clientID: dummy.clientID,
      });

      const waitToSendTransaction = uw.sendTransaction({
        chainID: dummy.chainID,
        toAddress: dummy.txToAddress,
        value: toHex(dummy.txValue),
        ticketToken: dummy.ticketToken,
      });

      expect(windowMock.open).toHaveBeenCalledTimes(1);

      xAPIMock.sendToClient(
        JSON.stringify({
          type: "signature",
          value: dummy.sig,
        } satisfies XResponse),
      );

      await expect(waitToSendTransaction).rejects.toThrow(
        new UWError("INVALID_RESPONSE", "unexpected type: signature"),
      );
    });

    it("rejects the first request, then accepts the second request", async () => {
      const uw = await UnWallet.init({
        env,
        clientID: dummy.clientID,
      });

      const waitToSendTransaction = uw.sendTransaction({
        chainID: dummy.chainID,
        toAddress: dummy.txToAddress,
        value: toHex(dummy.txValue),
        ticketToken: dummy.ticketToken,
      });

      expect(windowMock.open).toHaveBeenCalledTimes(1);

      xAPIMock.sendToClient(
        JSON.stringify({
          type: "error",
          value: "rejected",
        } satisfies XResponse),
      );

      await expect(waitToSendTransaction).rejects.toThrow(
        new UWError("REQUEST_REJECTED"),
      );

      const waitToSendTransactionAgain = uw.sendTransaction({
        chainID: dummy.chainID,
        toAddress: dummy.txToAddress,
        data: toHex(dummy.txData),
        ticketToken: dummy.ticketToken,
      });

      expect(windowMock.open).toHaveBeenCalledTimes(2);

      xAPIMock.sendToClient(
        JSON.stringify({
          type: "transactionID",
          value: dummy.txID,
        } satisfies XResponse),
      );

      await expect(waitToSendTransactionAgain).resolves.toEqual({
        transactionID: dummy.txID,
      } satisfies SendTransactionResult);
    });
  });
});

function safeParseAssignedLocationURLInMockCalls(idx: number = 0) {
  return z
    .tuple([z.union([z.url(), z.instanceof(URL)])])
    .transform((val) => new URL(val[0]))
    .safeParse(locationMock.assign.mock.calls[idx]);
}

function safeParseOpenedWindowURLInMockCalls(idx: number = 0) {
  return z
    .tuple([
      z.url(),
      z.literal("_blank"),
      z.literal(
        `width=${screenMock.width / 2},height=${screenMock.height},left=${screenMock.width / 4},top=0`,
      ),
    ])
    .transform((val) => new URL(val[0]))
    .safeParse(windowMock.open.mock.calls[idx]);
}
