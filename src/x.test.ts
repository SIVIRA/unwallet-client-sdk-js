import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { UWError } from "./error";
import { XAPIMockHandlers, mockXAPI } from "./testutil";
import { XAction, XConnection, XResponse } from "./x";

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

    it("rejects on invalid response: unexpected type", async () => {
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
});
