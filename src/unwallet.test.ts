import { sha256, toBytes } from "viem";
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
import { UWError } from "./error";
import { mockXAPI, randomBytesHex } from "./testutil";
import { SignResult, UnWallet } from "./unwallet";
import { XResponse } from "./x";

const env = "dev";
const uwConfig = getUnWalletConfigByEnv(env);

const xConnID = "xconn";

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
          value: xConnID,
        } satisfies XResponse),
      ),
  },
});

const clientID = "C00000000000000000000000000000000";

const messageToBeSigned = "message to be signed";
const digestOfMessageToBeSigned = sha256(toBytes(messageToBeSigned));
const ticketToken = randomBytesHex(32);

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
});
afterAll(() => xAPIMock.server.close());

describe("UnWallet", () => {
  describe("authorize", () => {
    it("redirects to the virtual authorization page: with default options", async () => {
      const redirectURL = "https://example.com/callback";

      const uw = await UnWallet.init({ env, clientID });

      uw.authorize({ redirectURL });

      let destURL: URL;
      {
        const result = safeParseAssignedLocationURLInMockCalls();
        if (!result.success) {
          expect.fail(z.prettifyError(result.error));
        }

        destURL = result.data;
      }
      expect(destURL.origin + destURL.pathname).toBe(
        `${uwConfig.frontend.baseURL}/vauthorize`,
      );
      expect(Object.fromEntries(destURL.searchParams)).toEqual({
        response_type: "id_token",
        response_mode: "fragment",
        client_id: clientID,
        scope: "openid",
        redirect_uri: redirectURL,
      });
    });

    it("redirects to the authorization page: with all options", async () => {
      const responseMode = "form_post";
      const redirectURL = "https://example.com/callback";
      const nonce = randomBytesHex(32);
      const chainID = 1;

      const uw = await UnWallet.init({ env, clientID });

      uw.authorize({
        responseMode,
        redirectURL,
        nonce,
        isVirtual: false,
        chainID,
      });

      let destURL: URL;
      {
        const result = safeParseAssignedLocationURLInMockCalls();
        if (!result.success) {
          expect.fail(z.prettifyError(result.error));
        }

        destURL = result.data;
      }
      expect(destURL.origin + destURL.pathname).toBe(
        `${uwConfig.frontend.baseURL}/authorize`,
      );
      expect(Object.fromEntries(destURL.searchParams)).toEqual({
        response_type: "id_token",
        response_mode: responseMode,
        client_id: clientID,
        scope: "openid",
        redirect_uri: redirectURL,
        nonce,
        chain_id: chainID.toString(),
      });
    });
  });

  describe("sign", () => {
    it("resolves the first request, then accepts the second request", async () => {
      const signature = randomBytesHex(65);

      const uw = await UnWallet.init({ env, clientID });

      const waitToSign = uw.sign({
        message: messageToBeSigned,
        ticketToken,
      });

      let windowURL: URL;
      {
        const result = safeParseOpenedWindowURLInMockCalls();
        if (!result.success) {
          expect.fail(z.prettifyError(result.error));
        }

        windowURL = result.data;
      }
      expect(windowURL.origin + windowURL.pathname).toBe(
        `${uwConfig.frontend.baseURL}/x/sign`,
      );
      expect(Object.fromEntries(windowURL.searchParams)).toEqual({
        connectionID: xConnID,
        clientID,
        message: messageToBeSigned,
        ticketToken,
      });

      xAPIMock.sendToClient(
        JSON.stringify({
          type: "signature",
          value: signature,
        } satisfies XResponse),
      );

      await expect(waitToSign).resolves.toEqual({
        digest: digestOfMessageToBeSigned,
        signature,
      } satisfies SignResult);

      const waitToSignAgain = uw.sign({
        message: messageToBeSigned,
        ticketToken,
      });

      xAPIMock.sendToClient(
        JSON.stringify({
          type: "signature",
          value: signature,
        } satisfies XResponse),
      );

      await expect(waitToSignAgain).resolves.toEqual({
        digest: digestOfMessageToBeSigned,
        signature,
      } satisfies SignResult);

      expect(windowMock.open).toHaveBeenCalledTimes(2);
    });

    it("rejects on an unopened connection", async () => {
      const uw = await UnWallet.init({ env, clientID });

      uw.close();

      const waitToSign = uw.sign({
        message: messageToBeSigned,
        ticketToken,
      });

      await expect(waitToSign).rejects.toThrow(
        new UWError("CONNECTION_NOT_OPENED"),
      );

      expect(windowMock.open).not.toHaveBeenCalled();
    });

    it("rejects on a request in progress", async () => {
      const uw = await UnWallet.init({ env, clientID });

      uw.sign({ message: messageToBeSigned, ticketToken });

      const waitToSignAgain = uw.sign({
        message: messageToBeSigned,
        ticketToken,
      });

      await expect(waitToSignAgain).rejects.toThrow(
        new UWError("REQUEST_IN_PROGRESS"),
      );

      expect(windowMock.open).toHaveBeenCalledTimes(1);
    });

    it("rejects on an invalid response: unexpected type: transaction id", async () => {
      const uw = await UnWallet.init({ env, clientID });

      const waitToSign = uw.sign({
        message: messageToBeSigned,
        ticketToken,
      });

      xAPIMock.sendToClient(
        JSON.stringify({
          type: "transactionID",
          value: randomBytesHex(32),
        } satisfies XResponse),
      );

      await expect(waitToSign).rejects.toThrow(
        new UWError("INVALID_RESPONSE", "unexpected type: transactionID"),
      );

      expect(windowMock.open).toHaveBeenCalledTimes(1);
    });

    it("rejects the first request, then accepts the second request", async () => {
      const signature = randomBytesHex(65);

      const uw = await UnWallet.init({ env, clientID });

      const waitToSign = uw.sign({
        message: messageToBeSigned,
        ticketToken,
      });

      xAPIMock.sendToClient(
        JSON.stringify({
          type: "error",
          value: "rejected",
        } satisfies XResponse),
      );

      await expect(waitToSign).rejects.toThrow(new UWError("REQUEST_REJECTED"));

      expect(windowMock.open).toHaveBeenCalledTimes(1);

      const waitToSignAgain = uw.sign({
        message: messageToBeSigned,
        ticketToken,
      });

      xAPIMock.sendToClient(
        JSON.stringify({
          type: "signature",
          value: signature,
        } satisfies XResponse),
      );

      await expect(waitToSignAgain).resolves.toEqual({
        digest: digestOfMessageToBeSigned,
        signature: signature,
      } satisfies SignResult);

      expect(windowMock.open).toHaveBeenCalledTimes(2);
    });
  });
});

function safeParseAssignedLocationURLInMockCalls() {
  return z
    .tuple([z.tuple([z.union([z.url(), z.instanceof(URL)])])])
    .transform((val) => new URL(val[0][0]))
    .safeParse(locationMock.assign.mock.calls);
}

function safeParseOpenedWindowURLInMockCalls() {
  return z
    .tuple([
      z.tuple([
        z.url(),
        z.literal("_blank"),
        z.literal(
          `width=${screenMock.width / 2},height=${screenMock.height},left=${screenMock.width / 4},top=0`,
        ),
      ]),
    ])
    .transform((val) => new URL(val[0][0]))
    .safeParse(windowMock.open.mock.calls);
}
