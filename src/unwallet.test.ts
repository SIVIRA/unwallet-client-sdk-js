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
import { mockXAPI, randomBytesHex } from "./testutil";
import { UnWallet } from "./unwallet";
import { XResponse } from "./x";

const env = "dev";
const uwConfig = getUnWalletConfigByEnv(env);

const xConnID = "xconn";

const locationMock = {
  assign: vi.fn(),
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

beforeAll(() =>
  xAPIMock.server.listen({
    onUnhandledRequest: "error", // prevent unhandled requests from passing through to the real server
  }),
);
beforeEach(() => {
  vi.stubGlobal("location", locationMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();

  xAPIMock.server.resetHandlers();
});
afterAll(() => xAPIMock.server.close());

describe("UnWallet", () => {
  describe("authorize", () => {
    it("redirects to the authorization page: with default options", async () => {
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
});

function safeParseAssignedLocationURLInMockCalls() {
  return z
    .tuple([z.tuple([z.union([z.url(), z.instanceof(URL)])])])
    .transform((val) => new URL(val[0][0]))
    .safeParse(locationMock.assign.mock.calls);
}
