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

export function mockXAPI(args: {
  readonly urls: string[];
  readonly handlers?: XAPIMockHandlers;
}): {
  readonly server: SetupServer;
  readonly connectedURL: () => URL;
  readonly sendToClient: (data: WebSocketData) => void;
  readonly closeClient: (code?: number, reason?: string) => void;
} {
  let client: WebSocketHandlerConnection["client"];

  const onConnection = (conn: WebSocketHandlerConnection) => {
    client = conn.client;

    conn.client.addEventListener("message", (event) => {
      let req: XRequest;
      {
        const result = xRequestPayloadSchema.safeParse(event.data);
        if (!result.success) {
          conn.client.send(
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
        client: conn.client,
        request: req,
      });

      switch (req.action) {
        case "getConnectionID":
          args?.handlers?.getConnectionID?.({
            client: conn.client,
            request: req,
          });
          break;
      }
    });

    conn.client.addEventListener("close", () =>
      args?.handlers?.onConnectionClosed?.({
        client: conn.client,
      }),
    );
  };

  const server = setupServer(
    ...args.urls.map((url) =>
      ws.link(url).addEventListener("connection", onConnection),
    ),
  );

  return {
    server,
    connectedURL: () => client.url,
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
