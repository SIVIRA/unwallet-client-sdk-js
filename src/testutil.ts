import { ws, WebSocketData, WebSocketHandlerConnection } from "msw";
import { SetupServer, setupServer } from "msw/node";
import { ByteArray, Hex, bytesToHex, toBytes } from "viem";
import { z } from "zod";

import { xRequestPayloadSchema, XRequest } from "./xconn";

export type XAPIMockHandlers = {
  beforeEachAction?: (args: {
    readonly client: WebSocketHandlerConnection["client"];
    readonly request: XRequest;
  }) => void;
  getConnectionID?: (args: {
    readonly client: WebSocketHandlerConnection["client"];
    readonly request: XRequest;
  }) => void;
  onConnectionClosed?: (args: {
    readonly client: WebSocketHandlerConnection["client"];
  }) => void;
};

export function base64URLEncode(s: string): string {
  return btoa(String.fromCharCode(...toBytes(s)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function mockXAPI(args: { url: string; handlers?: XAPIMockHandlers }): {
  server: SetupServer;
  sendToClient: (data: WebSocketData) => void;
  closeClient: (code?: number, reason?: string) => void;
} {
  const interceptor = ws.link(args.url);

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

        args?.handlers?.beforeEachAction?.({
          client: connection.client,
          request: req,
        });

        switch (req.action) {
          case "getConnectionID":
            args?.handlers?.getConnectionID?.({
              client: connection.client,
              request: req,
            });
            break;
        }
      });

      connection.client.addEventListener("close", () =>
        args?.handlers?.onConnectionClosed?.({
          client: connection.client,
        }),
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

export function randomBytesHex(length: number): Hex {
  return bytesToHex(randomBytes(length));
}
