import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { UWError } from "./error";
import { XAPIMockHandlers, mockXAPI, randomBytesHex } from "./testutil";
import { XAction, XConnection, XConnectionOptions, XResponse } from "./x";

const xAPIURL = "wss://uwxapi.com";
const xAPIMockHandlers: Omit<XAPIMockHandlers, "beforeEachAction"> = {
  getConnectionID: () => {},
  onConnectionClosed: () => {},
};
const xAPIMock = mockXAPI(xAPIURL, {
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

const xConnID = "xconn";

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
        value: xConnID,
      } satisfies XResponse),
    );
  };

  return await XConnection.init(
    {
      url: xAPIURL,
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
beforeEach(() => {
  xAPIMock.server.resetHandlers();
  xAPIMockHandlers.getConnectionID = () => {};
  xAPIMockHandlers.onConnectionClosed = () => {};
  xActionToCallCount.getConnectionID = 0;
});
afterAll(() => xAPIMock.server.close());

describe("XConnection", () => {
  describe("init", () => {
    it("resolves", async () => {
      xAPIMockHandlers.getConnectionID = (args) => {
        args.client.send(
          JSON.stringify({
            type: "connectionID",
            value: xConnID,
          } satisfies XResponse),
        );
      };

      const xConn = await XConnection.init({
        url: xAPIURL,
        connectionTimeout: 1_000,
      });
      expect(xConn.id).toBe(xConnID);
      expect(xConn.readyState).toBe(WebSocket.OPEN);

      expect(xActionToCallCount.getConnectionID).toBe(1);
    });

    it("rejects on invalid response: invalid payload", async () => {
      let isXConnectionClosed = false;

      xAPIMockHandlers.getConnectionID = (args) =>
        args.client.send("invalid json string");
      xAPIMockHandlers.onConnectionClosed = () => (isXConnectionClosed = true);

      await expect(
        XConnection.init({
          url: xAPIURL,
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

    it("rejects on invalid response: unexpected type: signature", async () => {
      let isXConnectionClosed = false;

      xAPIMockHandlers.getConnectionID = (args) => {
        args.client.send(
          JSON.stringify({
            type: "signature",
            value: randomBytesHex(65),
          } satisfies XResponse),
        );
      };
      xAPIMockHandlers.onConnectionClosed = () => (isXConnectionClosed = true);

      await expect(
        XConnection.init({
          url: xAPIURL,
          connectionTimeout: 1_000,
        }),
      ).rejects.toThrow(
        new UWError("INVALID_RESPONSE", "unexpected type: signature"),
      );

      expect(xActionToCallCount.getConnectionID).toBe(1);
      expect(isXConnectionClosed).toBe(true);
    });

    it("rejects on invalid response: unexpected type: error", async () => {
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
          url: xAPIURL,
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

    it("rejects on connection timeout", async () => {
      let isXConnectionClosed = false;

      xAPIMockHandlers.onConnectionClosed = () => (isXConnectionClosed = true);

      await expect(
        XConnection.init({
          url: xAPIURL,
          connectionTimeout: 100,
        }),
      ).rejects.toThrow(new UWError("CONNECTION_TIMEOUT"));

      expect(xActionToCallCount.getConnectionID).toBe(1);
      expect(isXConnectionClosed).toBe(true);
    });

    it("rejects on connection closed", async () => {
      xAPIMockHandlers.getConnectionID = (args) =>
        args.client.close(undefined, "something went wrong");

      await expect(
        XConnection.init({
          url: xAPIURL,
          connectionTimeout: 1_000,
        }),
      ).rejects.toThrow(
        new UWError("CONNECTION_CLOSED", "something went wrong"),
      );

      expect(xActionToCallCount.getConnectionID).toBe(1);
    });
  });

  describe("handle response", () => {
    it("resolves with signature", async () => {
      const xConn = await initXConnection();
      const waitXResp = new Promise<XResponse>((resolve, reject) => {
        xConn.setResponseHandler({ resolve, reject });
      });

      const xResp = {
        type: "signature",
        value: randomBytesHex(65),
      } satisfies XResponse;

      xAPIMock.sendToClient(JSON.stringify(xResp));

      await expect(waitXResp).resolves.toEqual(xResp);
    });

    it("resolves with transaction id", async () => {
      const xConn = await initXConnection();
      const waitXResp = new Promise<XResponse>((resolve, reject) => {
        xConn.setResponseHandler({ resolve, reject });
      });

      const xResp = {
        type: "transactionID",
        value: randomBytesHex(32),
      } satisfies XResponse;

      xAPIMock.sendToClient(JSON.stringify(xResp));

      await expect(waitXResp).resolves.toEqual(xResp);
    });

    it("ignores message event", async () => {
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
          value: randomBytesHex(65),
        } satisfies XResponse),
      );

      await vi.waitUntil(() => isMessageEventDropped);
    });

    it("rejects on invalid response: invalid payload", async () => {
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

    it("rejects on error: rejected", async () => {
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

    it("rejects on error: unexpected value", async () => {
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

    it("ignores close event", async () => {
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

    it("rejects on connection closed", async () => {
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
});
