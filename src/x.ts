import { z } from "zod";

import { UnWalletXAPIConfig } from "./config";
import { UWError } from "./error";

const X_ACTIONS = ["getConnectionID"] as const;

export type XAction = (typeof X_ACTIONS)[number];

export const xRequestSchema = z.object({
  action: z.enum(X_ACTIONS),
});

export const xRequestPayloadSchema = z
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
  .pipe(xRequestSchema);

export type XRequest = z.infer<typeof xRequestSchema>;

const X_RESPONSE_TYPES = [
  "connectionID",
  "signature",
  "transactionID",
  "error",
] as const;

export const xResponseSchema = z.object({
  type: z.enum(X_RESPONSE_TYPES),
  value: z.string(),
});

export const xResponsePayloadSchema = z
  .string()
  .refine(
    (val) => {
      try {
        JSON.parse(val);
      } catch (e) {
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
  .pipe(xResponseSchema);

export type XResponseType = (typeof X_RESPONSE_TYPES)[number];
export type XResponse = z.infer<typeof xResponseSchema>;

export type XResponseHandler = {
  resolve: (resp: XResponse) => void;
  reject: (err: UWError) => void;
};

export class XConnection {
  public readonly id: string;

  private socket: WebSocket;
  private responseHandler: XResponseHandler | null = null;

  constructor(args: { id: string; socket: WebSocket }) {
    this.id = args.id;
    this.socket = args.socket;
    this.initListeners();
  }

  public static async init(config: UnWalletXAPIConfig): Promise<XConnection> {
    const socket = new WebSocket(config.url);

    const id = await new Promise<string>((resolve, reject) => {
      const timeoutID = setTimeout(
        () => abortHandshake(new UWError("CONNECTION_TIMEOUT")),
        config.connectionTimeout,
      );

      const detachListeners = () => {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
      };

      const completeHandshake = (id: string) => {
        clearTimeout(timeoutID);
        detachListeners();
        resolve(id);
      };
      const abortHandshake = (err: UWError) => {
        clearTimeout(timeoutID);
        detachListeners();
        socket.close();
        reject(err);
      };

      socket.onopen = () =>
        socket.send(
          JSON.stringify({ action: "getConnectionID" } satisfies XRequest),
        );

      socket.onmessage = (event) => {
        let resp: XResponse;
        {
          const result = safeParseXResponsePayload(event.data);
          if (!result.success) {
            abortHandshake(result.error);
            return;
          }

          resp = result.data;
        }
        if (resp.type !== "connectionID") {
          abortHandshake(newUnexpectedXResponseTypeError(resp));
          return;
        }

        completeHandshake(resp.value);
      };

      socket.onerror = () => abortHandshake(new UWError("CONNECTION_FAILED"));

      socket.onclose = (event) =>
        abortHandshake(new UWError("CONNECTION_CLOSED", event.reason));
    });

    return new XConnection({ id, socket });
  }

  private initListeners(): void {
    this.socket.onopen = null;

    this.socket.onmessage = (event) => {
      if (this.responseHandler === null) {
        return;
      }

      let resp: XResponse;
      {
        const result = safeParseXResponsePayload(event.data);
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
                  `unexpected error value: ${resp.value}`,
                ),
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
        new UWError("CONNECTION_CLOSED", event.reason),
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
}

function safeParseXResponsePayload(
  data: unknown,
): { success: true; data: XResponse } | { success: false; error: UWError } {
  const result = xResponsePayloadSchema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      error: new UWError(
        "INVALID_RESPONSE",
        `invalid payload: ${z.prettifyError(result.error)}`,
      ),
    };
  }

  return {
    success: true,
    data: result.data,
  };
}

export function newUnexpectedXResponseTypeError(resp: XResponse): UWError {
  let msg = `unexpected type: ${resp.type}`;

  if (resp.type === "error") {
    msg += ` (value: ${resp.value})`;
  }

  return new UWError("INVALID_RESPONSE", msg);
}
