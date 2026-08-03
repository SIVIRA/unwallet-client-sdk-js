import { ws } from "msw";
import { setupServer } from "msw/node";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";
import { z } from "zod";

import { getUnWalletConfigByEnv } from "./config";
import { XConnection } from "./x";

const uwConfig = getUnWalletConfigByEnv("dev");

const mockServer = setupServer();
const mockUWXAPI = ws.link(uwConfig.xapi.url);

let actionToCallCount: Record<"getConnectionID", number> = {
  getConnectionID: 0,
};

beforeAll(() =>
  mockServer.listen({
    onUnhandledRequest: "error", // prevent unhandled requests from passing through to the real server
  }),
);
beforeEach(() => {
  mockServer.resetHandlers();
  actionToCallCount = {
    getConnectionID: 0,
  };
});
afterAll(() => mockServer.close());

describe("XConnection.init", () => {
  test("success", async () => {
    const xConnectionID = "conn";

    mockServer.use(
      mockUWXAPI.addEventListener("connection", ({ client }) => {
        client.addEventListener("message", (event) => {
          {
            const result = z
              .string()
              .refine(
                (val) => {
                  try {
                    JSON.parse(val);
                  } catch {
                    return false;
                  }
                  return true;
                },
                {
                  abort: true,
                  message: "Invalid JSON string",
                },
              )
              .transform((val) => JSON.parse(val))
              .pipe(
                z.object({
                  action: z.literal("getConnectionID"),
                }),
              )
              .safeParse(event.data);
            if (!result.success) {
              client.send(
                JSON.stringify({
                  type: "error",
                  value: z.prettifyError(result.error),
                }),
              );
              return;
            }
          }

          actionToCallCount.getConnectionID++;

          client.send(
            JSON.stringify({ type: "connectionID", value: xConnectionID }),
          );
        });
      }),
    );

    const xConnection = await XConnection.init(uwConfig.xapi);
    expect(xConnection.id).toBe(xConnectionID);
    expect(xConnection.readyState).toBe(WebSocket.OPEN);

    expect(actionToCallCount.getConnectionID).toBe(1);
  });
});
