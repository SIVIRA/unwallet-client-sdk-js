import { ws, WebSocketHandlerConnection } from "msw";
import { SetupServer, setupServer } from "msw/node";
import { z } from "zod";

import { UnWalletXAPIConfig } from "./config";
import { xRequestPayloadSchema, XRequest } from "./x";

export type XActionMockArgs = {
  client: WebSocketHandlerConnection["client"];
  request: XRequest;
};

export function mockXAPI(args: {
  config: UnWalletXAPIConfig;
  beforeEachAction?: (req: XRequest) => void;
  handleGetConnectionID?: (args: XActionMockArgs) => void;
}): {
  server: SetupServer;
  sendToClient: (data: unknown) => void;
} {
  const interceptor = ws.link(args.config.url);

  let client: WebSocketHandlerConnection["client"];

  const server = setupServer(
    interceptor.addEventListener("connection", (connection) => {
      client = connection.client;

      client.addEventListener("message", (event) => {
        let req: XRequest;
        {
          const result = xRequestPayloadSchema.safeParse(event.data);
          if (!result.success) {
            client.send(
              JSON.stringify({
                type: "error",
                value: z.prettifyError(result.error),
              }),
            );
            return;
          }

          req = result.data;
        }

        args.beforeEachAction?.(req);

        switch (req.action) {
          case "getConnectionID":
            args.handleGetConnectionID?.({
              client,
              request: req,
            });
            break;
        }
      });
    }),
  );

  return {
    server,
    sendToClient: (data: unknown) => client.send(JSON.stringify(data)),
  };
}
