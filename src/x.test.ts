import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";

import { UnWalletXAPIConfig } from "./config";
import { UWError } from "./error";
import { XActionMockArgs, mockXAPI } from "./testutil";
import { XAction, XConnection, XResponse } from "./x";

const xAPIConfig: UnWalletXAPIConfig = {
  url: "wss://uwxapi.com",
  connectionTimeout: 1_000,
};
const xConnID = "xconn";

let xActionToCallCount: Record<XAction, number> = {
  getConnectionID: 0,
};

let handleGetConnectionID: (args: XActionMockArgs) => void = () => {};

const xAPIMock = mockXAPI({
  config: xAPIConfig,
  beforeEachAction: (req) => {
    switch (req.action) {
      case "getConnectionID":
        xActionToCallCount.getConnectionID++;
        break;
    }
  },
  handleGetConnectionID: (args) => handleGetConnectionID(args),
});

beforeAll(() =>
  xAPIMock.server.listen({
    onUnhandledRequest: "error", // prevent unhandled requests from passing through to the real server
  }),
);
beforeEach(() => {
  xAPIMock.server.resetHandlers();
  xActionToCallCount = {
    getConnectionID: 0,
  };
});
afterAll(() => xAPIMock.server.close());

describe("XConnection", () => {
  test("success: init", async () => {
    handleGetConnectionID = ({ client }) => {
      client.send(
        JSON.stringify({
          type: "connectionID",
          value: xConnID,
        } satisfies XResponse),
      );
    };

    const xConn = await XConnection.init(xAPIConfig);
    expect(xConn.id).toBe(xConnID);
    expect(xConn.readyState).toBe(WebSocket.OPEN);

    expect(xActionToCallCount.getConnectionID).toBe(1);
  });

  test("failure: init: invalid response: unexpected type", async () => {
    handleGetConnectionID = ({ client }) => {
      client.send(
        JSON.stringify({
          type: "error",
          value: "something went wrong",
        } satisfies XResponse),
      );
    };

    await expect(XConnection.init(xAPIConfig)).rejects.toThrow(
      new UWError(
        "INVALID_RESPONSE",
        "unexpected type: error (value: something went wrong)",
      ),
    );

    expect(xActionToCallCount.getConnectionID).toBe(1);
  });
});
