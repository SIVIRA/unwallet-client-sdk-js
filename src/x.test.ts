import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";

import { getUnWalletConfigByEnv } from "./config";
import { mockXAPI } from "./testutil";
import { XAction, XConnection } from "./x";

const uwConfig = getUnWalletConfigByEnv("dev");

const xConnID = "xconn";

let xActionToCallCount: Record<XAction, number> = {
  getConnectionID: 0,
};

const xAPIMock = mockXAPI({
  config: uwConfig.xAPI,
  beforeEachAction: (req) => {
    switch (req.action) {
      case "getConnectionID":
        xActionToCallCount.getConnectionID++;
        break;
    }
  },
  handleGetConnectionID: ({ client }) => {
    client.send(
      JSON.stringify({
        type: "connectionID",
        value: xConnID,
      }),
    );
  },
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

describe("XConnection.init", () => {
  test("success", async () => {
    const xConn = await XConnection.init(uwConfig.xAPI);
    expect(xConn.id).toBe(xConnID);
    expect(xConn.readyState).toBe(WebSocket.OPEN);

    expect(xActionToCallCount.getConnectionID).toBe(1);
  });
});
