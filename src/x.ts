import { z } from "zod/v4";

import { UnWalletXAPIConfig } from "./config";
import { UWError } from "./error";

export const VALID_X_RESPONSE_TYPES = [
  "connectionID",
  "signature",
  "transactionID",
  "error",
] as const;

export type XResponseType = (typeof VALID_X_RESPONSE_TYPES)[number];

export interface XResponse {
  readonly type: XResponseType;
  readonly value: string;
}

export interface XResponseHandler {
  resolve: (resp: XResponse) => void;
  reject: (err: UWError) => void;
}

export class XConnection {
  private socket: WebSocket;
  private responseHandler: XResponseHandler | null = null;

  public readonly id: string;

  constructor(args: { socket: WebSocket; id: string }) {
    this.socket = args.socket;
    this.id = args.id;

    this.initListeners();
  }

  private initListeners(): void {
    this.socket.onopen = null;

    this.socket.onmessage = (event) => {
      if (this.responseHandler === null) {
        return;
      }

      let resp: XResponse;
      {
        const result = safeParseMessageEventDataToXResponse(event.data);
        if (!result.success) {
          this.responseHandler.reject(result.error);
          return;
        }

        resp = result.data;
      }

      switch (resp.type) {
        case "error":
          switch (resp.value) {
            case "rejected":
              this.responseHandler.reject(new UWError("REQUEST_REJECTED"));
              break;
            default:
              this.responseHandler.reject(
                new UWError(
                  "INVALID_RESPONSE",
                  `unexpected error response value: ${resp.value}`
                )
              );
          }
          break;
        default:
          this.responseHandler.resolve(resp);
      }
    };

    this.socket.onerror = null;

    this.socket.onclose = (event) => {
      if (this.responseHandler === null) {
        return;
      }

      this.responseHandler.reject(
        new UWError("CONNECTION_CLOSED", event.reason)
      );
    };
  }

  public get readyState(): number {
    return this.socket.readyState;
  }

  public get hasResponseHandler(): boolean {
    return this.responseHandler !== null;
  }

  public setResponseHandler(handler: XResponseHandler | null): void {
    this.responseHandler = handler;
  }

  public static async init(config: UnWalletXAPIConfig): Promise<XConnection> {
    const socket = new WebSocket(config.url);

    const id = await new Promise<string>((resolve, reject) => {
      setInterval(
        () => reject(new UWError("CONNECTION_TIMEOUT")),
        config.connectionTimeout
      );

      socket.onopen = () =>
        socket.send(JSON.stringify({ action: "getConnectionID" }));

      socket.onmessage = (event) => {
        let resp: XResponse;
        {
          const result = safeParseMessageEventDataToXResponse(event.data);
          if (!result.success) {
            reject(result.error);
            return;
          }

          resp = result.data;
        }
        if (resp.type !== "connectionID") {
          reject(
            new UWError(
              "INVALID_RESPONSE",
              `unexpected response type: ${resp.type}`
            )
          );
          return;
        }

        resolve(resp.value);
      };

      socket.onerror = () => reject(new UWError("CONNECTION_FAILED"));

      socket.onclose = (event) =>
        reject(new UWError("CONNECTION_CLOSED", event.reason));
    });

    return new XConnection({ socket, id });
  }
}

function safeParseMessageEventDataToXResponse(data: unknown):
  | {
      success: true;
      data: XResponse;
    }
  | {
      success: false;
      error: UWError;
    } {
  let s: string;
  {
    const result = z
      .string()
      .refine((val) => {
        try {
          JSON.parse(val);
        } catch (e) {
          return false;
        }
        return true;
      })
      .safeParse(data);
    if (!result.success) {
      return {
        success: false,
        error: new UWError(
          "INVALID_RESPONSE",
          "message event data must be a json string"
        ),
      };
    }

    s = result.data;
  }

  let parsed: XResponse;
  {
    const result = z
      .object({
        type: z.enum(VALID_X_RESPONSE_TYPES),
        value: z.string(),
      })
      .safeParse(JSON.parse(s));
    if (!result.success) {
      return {
        success: false,
        error: new UWError(
          "INVALID_RESPONSE",
          `invalid message event data: ${result.error.message}`
        ),
      };
    }

    parsed = result.data;
  }

  return {
    success: true,
    data: parsed,
  };
}
