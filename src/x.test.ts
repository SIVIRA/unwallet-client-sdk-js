import { Hex } from "viem";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { UWError } from "./error";
import {
  XAPIMockHandlers,
  base64URLEncode,
  mockXAPI,
  randomBytesHex,
} from "./testutil";
import { XAction, XConnection, XConnectionOptions, XResponse } from "./x";

const dummy = ((): {
  xAPIURL: string;

  xConnID: string;

  sig: Hex;
  txID: string;
} => {
  return {
    xAPIURL: "wss://uwxapi.com",

    xConnID: "xconn",

    sig: randomBytesHex(65),
    txID: base64URLEncode("Transaction:1"),
  };
})();

const xAPIMockHandlers: Omit<XAPIMockHandlers, "beforeEachAction"> = {
  getConnectionID: () => {},
  onConnectionClosed: () => {},
};
const xAPIMock = mockXAPI(dummy.xAPIURL, {
  handlers: {
    beforeEachAction: (args) => {
      switch (args.request.action) {
        case "getConnectionID":
          xActionToCallCount.getConnectionID++;
          break;
      }
    },
    getConnectionID: (args) => xAPIMockHandlers.getConnectionID?.(args),
    onConnectionClosed: (args) => xAPIMockHandlers.onConnectionClosed?.(args),
  },
});

const xActionToCallCount: Record<XAction, number> = {
  getConnectionID: 0,
};

async function initXConnection(
  opts?: XConnectionOptions,
): Promise<XConnection> {
  xAPIMockHandlers.getConnectionID = (args) => {
    args.client.send(
      JSON.stringify({
        type: "connectionID",
        value: dummy.xConnID,
      } satisfies XResponse),
    );
  };

  return await XConnection.init(
    {
      url: dummy.xAPIURL,
      connectionTimeout: 1_000,
    },
    opts,
  );
}

beforeAll(() =>
  xAPIMock.server.listen({
    onUnhandledRequest: "error", // prevent unhandled requests from passing through to the real server
  }),
);
afterEach(() => {
  xAPIMockHandlers.getConnectionID = () => {};
  xAPIMockHandlers.onConnectionClosed = () => {};

  xAPIMock.server.resetHandlers();

  xActionToCallCount.getConnectionID = 0;
});
afterAll(() => xAPIMock.server.close());

describe("XConnection", () => {
  describe("init", () => {
    it("resolves with the connection id", async () => {
      xAPIMockHandlers.getConnectionID = (args) => {
        args.client.send(
          JSON.stringify({
            type: "connectionID",
            value: dummy.xConnID,
          } satisfies XResponse),
        );
      };

      const xConn = await XConnection.init({
        url: dummy.xAPIURL,
        connectionTimeout: 1_000,
      });
      expect(xConn.id).toBe(dummy.xConnID);
      expect(xConn.readyState).toBe(WebSocket.OPEN);

      expect(xActionToCallCount.getConnectionID).toBe(1);
    });

    it("rejects on an invalid response: invalid payload", async () => {
      let isXConnectionClosed = false;

      xAPIMockHandlers.getConnectionID = (args) =>
        args.client.send("invalid json string");
      xAPIMockHandlers.onConnectionClosed = () => (isXConnectionClosed = true);

      await expect(
        XConnection.init({
          url: dummy.xAPIURL,
          connectionTimeout: 1_000,
        }),
      ).rejects.toThrow(
        new UWError(
          "INVALID_RESPONSE",
          "invalid payload: ✖ Invalid JSON string",
        ),
      );

      expect(xActionToCallCount.getConnectionID).toBe(1);
      expect(isXConnectionClosed).toBe(true);
    });

    it("rejects on an invalid response: unexpected type: signature", async () => {
      let isXConnectionClosed = false;

      xAPIMockHandlers.getConnectionID = (args) => {
        args.client.send(
          JSON.stringify({
            type: "signature",
            value: dummy.sig,
          } satisfies XResponse),
        );
      };
      xAPIMockHandlers.onConnectionClosed = () => (isXConnectionClosed = true);

      await expect(
        XConnection.init({
          url: dummy.xAPIURL,
          connectionTimeout: 1_000,
        }),
      ).rejects.toThrow(
        new UWError("INVALID_RESPONSE", "unexpected type: signature"),
      );

      expect(xActionToCallCount.getConnectionID).toBe(1);
      expect(isXConnectionClosed).toBe(true);
    });

    it("rejects on an invalid response: unexpected type: error", async () => {
      let isXConnectionClosed = false;

      xAPIMockHandlers.getConnectionID = (args) => {
        args.client.send(
          JSON.stringify({
            type: "error",
            value: "something went wrong",
          } satisfies XResponse),
        );
      };
      xAPIMockHandlers.onConnectionClosed = () => (isXConnectionClosed = true);

      await expect(
        XConnection.init({
          url: dummy.xAPIURL,
          connectionTimeout: 1_000,
        }),
      ).rejects.toThrow(
        new UWError(
          "INVALID_RESPONSE",
          "unexpected type: error (value: something went wrong)",
        ),
      );

      expect(xActionToCallCount.getConnectionID).toBe(1);
      expect(isXConnectionClosed).toBe(true);
    });

    it("rejects on a connection timeout", async () => {
      let isXConnectionClosed = false;

      xAPIMockHandlers.onConnectionClosed = () => (isXConnectionClosed = true);

      await expect(
        XConnection.init({
          url: dummy.xAPIURL,
          connectionTimeout: 100,
        }),
      ).rejects.toThrow(new UWError("CONNECTION_TIMEOUT"));

      expect(xActionToCallCount.getConnectionID).toBe(1);
      expect(isXConnectionClosed).toBe(true);
    });

    it("rejects on a closed connection", async () => {
      xAPIMockHandlers.getConnectionID = (args) =>
        args.client.close(undefined, "something went wrong");

      await expect(
        XConnection.init({
          url: dummy.xAPIURL,
          connectionTimeout: 1_000,
        }),
      ).rejects.toThrow(
        new UWError("CONNECTION_CLOSED", "something went wrong"),
      );

      expect(xActionToCallCount.getConnectionID).toBe(1);
    });
  });

  describe("handle response", () => {
    it("resolves with a signature", async () => {
      const xConn = await initXConnection();
      const waitXResp = new Promise<XResponse>((resolve, reject) => {
        xConn.setResponseHandler({ resolve, reject });
      });

      const xResp = {
        type: "signature",
        value: dummy.sig,
      } satisfies XResponse;

      xAPIMock.sendToClient(JSON.stringify(xResp));

      await expect(waitXResp).resolves.toEqual(xResp);
    });

    it("resolves with a transaction id", async () => {
      const xConn = await initXConnection();
      const waitXResp = new Promise<XResponse>((resolve, reject) => {
        xConn.setResponseHandler({ resolve, reject });
      });

      const xResp = {
        type: "transactionID",
        value: dummy.txID,
      } satisfies XResponse;

      xAPIMock.sendToClient(JSON.stringify(xResp));

      await expect(waitXResp).resolves.toEqual(xResp);
    });

    it("ignores a message event", async () => {
      let isMessageEventDropped = false;

      const xConn = await initXConnection({
        debugHandlers: {
          onMessageEventDropped: () => (isMessageEventDropped = true),
        },
      });
      expect(xConn.hasResponseHandler).toBe(false);

      xAPIMock.sendToClient(
        JSON.stringify({
          type: "signature",
          value: dummy.sig,
        } satisfies XResponse),
      );

      await vi.waitUntil(() => isMessageEventDropped);
    });

    it("rejects on an invalid response: invalid payload", async () => {
      const xConn = await initXConnection();
      const waitXResp = new Promise<XResponse>((resolve, reject) => {
        xConn.setResponseHandler({ resolve, reject });
      });

      xAPIMock.sendToClient("invalid json string");

      await expect(waitXResp).rejects.toThrow(
        new UWError(
          "INVALID_RESPONSE",
          "invalid payload: ✖ Invalid JSON string",
        ),
      );
    });

    it("rejects on an error response: rejected", async () => {
      const xConn = await initXConnection();
      const waitXResp = new Promise<XResponse>((resolve, reject) => {
        xConn.setResponseHandler({ resolve, reject });
      });

      xAPIMock.sendToClient(
        JSON.stringify({
          type: "error",
          value: "rejected",
        } satisfies XResponse),
      );

      await expect(waitXResp).rejects.toThrow(new UWError("REQUEST_REJECTED"));
    });

    it("rejects on an error response: unexpected value", async () => {
      const xConn = await initXConnection();
      const waitXResp = new Promise<XResponse>((resolve, reject) => {
        xConn.setResponseHandler({ resolve, reject });
      });

      xAPIMock.sendToClient(
        JSON.stringify({
          type: "error",
          value: "something went wrong",
        } satisfies XResponse),
      );

      await expect(waitXResp).rejects.toThrow(
        new UWError(
          "INVALID_RESPONSE",
          "unexpected error value: something went wrong",
        ),
      );
    });

    it("ignores a close event", async () => {
      let isCloseEventDropped = false;

      const xConn = await initXConnection({
        debugHandlers: {
          onCloseEventDropped: () => (isCloseEventDropped = true),
        },
      });
      expect(xConn.hasResponseHandler).toBe(false);

      xAPIMock.closeClient();

      await vi.waitUntil(() => isCloseEventDropped);
    });

    it("rejects on a closed connection", async () => {
      const xConn = await initXConnection();
      const waitXResp = new Promise<XResponse>((resolve, reject) => {
        xConn.setResponseHandler({ resolve, reject });
      });

      xAPIMock.closeClient(undefined, "something went wrong");

      await expect(waitXResp).rejects.toThrow(
        new UWError("CONNECTION_CLOSED", "something went wrong"),
      );
    });
  });

  describe("close", () => {
    it("closes the connection", async () => {
      let isXConnectionClosed = false;

      xAPIMockHandlers.onConnectionClosed = () => (isXConnectionClosed = true);

      const xConn = await initXConnection();

      xConn.close();

      await vi.waitUntil(() => isXConnectionClosed);
      await vi.waitUntil(() => xConn.readyState === WebSocket.CLOSED);
    });

    it("rejects the pending response handler", async () => {
      const xConn = await initXConnection();
      const waitXResp = new Promise<XResponse>((resolve, reject) => {
        xConn.setResponseHandler({ resolve, reject });
      });

      xConn.close();

      await expect(waitXResp).rejects.toThrow(new UWError("CONNECTION_CLOSED"));
    });
  });
});
