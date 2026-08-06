import {
  BaseError,
  hashTypedData,
  toBytes,
  sha256,
  validateTypedData,
} from "viem";

import { Env, Config, UnWalletConfig, getUnWalletConfigByEnv } from "./config";
import { EIP712TypedData } from "./eip712";
import { UWError } from "./error";
import { XConnection, newUnexpectedXResponseTypeError } from "./x";

export type AuthorizationResponseMode = "fragment" | "form_post";

export interface SignResult {
  digest: string;
  signature: string;
}

export interface SendTransactionResult {
  transactionID: string;
}

export class UnWallet {
  private readonly env: Env;
  private readonly clientID: string;
  private readonly xConnection: XConnection;

  constructor(args: { env: Env; clientID: string; xConnection: XConnection }) {
    this.env = args.env;
    this.clientID = args.clientID;
    this.xConnection = args.xConnection;
  }

  public static async init(config: Config): Promise<UnWallet> {
    const env = config.env ?? "prod";

    return new UnWallet({
      env: env,
      clientID: config.clientID,
      xConnection: await XConnection.init(getUnWalletConfigByEnv(env).xAPI),
    });
  }

  private get uwConfig(): UnWalletConfig {
    return getUnWalletConfigByEnv(this.env);
  }

  public authorize(args: {
    responseMode?: AuthorizationResponseMode;
    redirectURL: string;
    nonce?: string;
    isVirtual?: boolean;
    chainID?: number;
  }): void {
    const url = new URL(
      `${this.uwConfig.frontend.baseURL}/${
        args.isVirtual === false ? "" : "v"
      }authorize`,
    );
    {
      url.searchParams.set("response_type", "id_token");
      url.searchParams.set("response_mode", args.responseMode ?? "fragment");
      url.searchParams.set("client_id", this.clientID);
      url.searchParams.set("scope", "openid");
      url.searchParams.set("redirect_uri", args.redirectURL);
      if (args.nonce !== undefined) {
        url.searchParams.set("nonce", args.nonce);
      }
      if (args.chainID !== undefined) {
        url.searchParams.set("chain_id", args.chainID.toString());
      }
    }

    location.assign(url);
  }

  public sign(args: {
    message: string;
    ticketToken: string;
  }): Promise<SignResult> {
    return new Promise<SignResult>((resolve, reject) => {
      if (this.xConnection.readyState !== WebSocket.OPEN) {
        reject(new UWError("CONNECTION_NOT_OPENED"));
        return;
      }
      if (this.xConnection.hasResponseHandler) {
        reject(new UWError("REQUEST_IN_PROGRESS"));
        return;
      }

      const digest = sha256(toBytes(args.message));

      this.xConnection.setResponseHandler({
        resolve: (resp) => {
          this.xConnection.setResponseHandler(null);

          if (resp.type !== "signature") {
            reject(newUnexpectedXResponseTypeError(resp));
            return;
          }

          resolve({
            digest: digest,
            signature: resp.value,
          });
        },
        reject: (err) => {
          this.xConnection.setResponseHandler(null);
          reject(err);
        },
      });

      const url = new URL(`${this.uwConfig.frontend.baseURL}/x/sign`);
      {
        url.searchParams.set("connectionID", this.xConnection.id);
        url.searchParams.set("clientID", this.clientID);
        url.searchParams.set("message", args.message);
        url.searchParams.set("ticketToken", args.ticketToken);
      }

      openWindow(url);
    });
  }

  public signEIP712TypedData(args: {
    typedData: EIP712TypedData;
    ticketToken: string;
  }): Promise<SignResult> {
    return new Promise<SignResult>((resolve, reject) => {
      if (this.xConnection.readyState !== WebSocket.OPEN) {
        reject(new UWError("CONNECTION_NOT_OPENED"));
        return;
      }
      if (this.xConnection.hasResponseHandler) {
        reject(new UWError("REQUEST_IN_PROGRESS"));
        return;
      }

      const { EIP712Domain: _, ...typedDataTypes } = args.typedData.types;
      const typedData = {
        ...args.typedData,
        types: typedDataTypes,
      };

      try {
        validateTypedData(typedData);
      } catch (e) {
        reject(
          new UWError(
            "INVALID_REQUEST",
            `invalid typed data: ${e instanceof BaseError ? e.shortMessage : String(e)}`,
          ),
        );
        return;
      }

      const digest = hashTypedData(typedData);

      this.xConnection.setResponseHandler({
        resolve: (resp) => {
          this.xConnection.setResponseHandler(null);

          if (resp.type !== "signature") {
            reject(newUnexpectedXResponseTypeError(resp));
            return;
          }

          resolve({
            digest: digest,
            signature: resp.value,
          });
        },
        reject: (err) => {
          this.xConnection.setResponseHandler(null);
          reject(err);
        },
      });

      const url = new URL(
        `${this.uwConfig.frontend.baseURL}/x/signEIP712TypedData`,
      );
      {
        url.searchParams.set("connectionID", this.xConnection.id);
        url.searchParams.set("clientID", this.clientID);
        url.searchParams.set("typedData", JSON.stringify(args.typedData));
        url.searchParams.set("ticketToken", args.ticketToken);
      }

      openWindow(url);
    });
  }

  public sendTransaction(args: {
    chainID: number;
    toAddress: string;
    value?: string;
    data?: string;
    ticketToken: string;
  }): Promise<SendTransactionResult> {
    return new Promise<SendTransactionResult>((resolve, reject) => {
      if (this.xConnection.readyState !== WebSocket.OPEN) {
        reject(new UWError("CONNECTION_NOT_OPENED"));
        return;
      }
      if (this.xConnection.hasResponseHandler) {
        reject(new UWError("REQUEST_IN_PROGRESS"));
        return;
      }

      if (args.value === undefined && args.data === undefined) {
        reject(
          new UWError("INVALID_REQUEST", "either value or data is required"),
        );
        return;
      }

      this.xConnection.setResponseHandler({
        resolve: (resp) => {
          this.xConnection.setResponseHandler(null);

          if (resp.type !== "transactionID") {
            reject(newUnexpectedXResponseTypeError(resp));
            return;
          }

          resolve({ transactionID: resp.value });
        },
        reject: (err) => {
          this.xConnection.setResponseHandler(null);
          reject(err);
        },
      });

      const url = new URL(
        `${this.uwConfig.frontend.baseURL}/x/sendTransaction`,
      );
      {
        url.searchParams.set("connectionID", this.xConnection.id);
        url.searchParams.set("clientID", this.clientID);
        url.searchParams.set("chainID", args.chainID.toString());
        url.searchParams.set("toAddress", args.toAddress);
        url.searchParams.set("value", args.value ?? "0x0");
        url.searchParams.set("data", args.data ?? "0x");
        url.searchParams.set("ticketToken", args.ticketToken);
      }

      openWindow(url);
    });
  }

  public close(): void {
    this.xConnection.close();
  }
}

function openWindow(url: URL): void {
  const width = screen.width / 2;
  const height = screen.height;
  const left = screen.width / 4;
  const top = 0;

  window.open(
    url.toString(),
    "_blank",
    `width=${width},height=${height},left=${left},top=${top}`,
  );
}
