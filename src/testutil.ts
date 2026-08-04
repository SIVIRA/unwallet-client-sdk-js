import { ws, WebSocketData, WebSocketHandlerConnection } from "msw";
import { SetupServer, setupServer } from "msw/node";
import { ByteArray, bytesToHex } from "viem";
import { z } from "zod";

import { xRequestPayloadSchema, XRequest } from "./x";

export type XAPIMockOptions = {
  handlers?: XAPIMockHandlers;
};

export type XAPIMockHandlers = {
  beforeEachAction?: (args: {
    client: WebSocketHandlerConnection["client"];
    request: XRequest;
  }) => void;
  getConnectionID?: (args: {
    client: WebSocketHandlerConnection["client"];
    request: XRequest;
  }) => void;
  onConnectionClosed?: (args: {
    client: WebSocketHandlerConnection["client"];
  }) => void;
};

export function mockXAPI(
  url: string,
  opts?: XAPIMockOptions,
): {
  server: SetupServer;
  sendToClient: (data: WebSocketData) => void;
  closeClient: (code?: number, reason?: string) => void;
} {
  const interceptor = ws.link(url);

  let client: WebSocketHandlerConnection["client"];

  const server = setupServer(
    interceptor.addEventListener("connection", (connection) => {
      client = connection.client;

      connection.client.addEventListener("message", (event) => {
        let req: XRequest;
        {
          const result = xRequestPayloadSchema.safeParse(event.data);
          if (!result.success) {
            connection.client.send(
              JSON.stringify({
                type: "error",
                value: z.prettifyError(result.error),
              }),
            );
            return;
          }

          req = result.data;
        }

        opts?.handlers?.beforeEachAction?.({
          client: connection.client,
          request: req,
        });

        switch (req.action) {
          case "getConnectionID":
            opts?.handlers?.getConnectionID?.({
              client: connection.client,
              request: req,
            });
            break;
        }
      });

      connection.client.addEventListener("close", () =>
        opts?.handlers?.onConnectionClosed?.({ client: connection.client }),
      );
    }),
  );

  return {
    server,
    sendToClient: (data: WebSocketData) => client.send(data),
    closeClient: (code?: number, reason?: string) => client.close(code, reason),
  };
}

export function randomBytes(length: number): ByteArray {
  return crypto.getRandomValues(new Uint8Array(length));
}

export function randomBytesHex(length: number): string {
  return bytesToHex(randomBytes(length));
}
