import { ethers } from "ethers";

import { Env, Config, UnWalletConfig, getUnWalletConfigByEnv } from "./config";
import { UWError } from "./error";
import { XConnection } from "./x";

export const VALID_AUTHORIZATION_RESPONSE_MODES = [
  "fragment",
  "form_post",
] as const;

export type AuthorizationResponseMode =
  (typeof VALID_AUTHORIZATION_RESPONSE_MODES)[number];

export interface SignResult {
  digest: string;
  signature: string;
}

export interface SendTransactionResult {
  transactionID: string;
}

export class UnWallet {
  private env: Env;
  private clientID: string;
  private xConnection: XConnection;

  constructor(args: { env: Env; clientID: string; xConnection: XConnection }) {
    this.env = args.env;
    this.clientID = args.clientID;
    this.xConnection = args.xConnection;
  }

  public static async init(config: Config): Promise<UnWallet> {
    const env = config.env !== undefined ? config.env : "prod";

    return new UnWallet({
      env: env,
      clientID: config.clientID,
      xConnection: await XConnection.init(getUnWalletConfigByEnv(env).xapi),
    });
  }

  private get unWalletConfig(): UnWalletConfig {
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
      `${this.unWalletConfig.frontend.baseURL}/${
        args.isVirtual !== undefined ? (args.isVirtual ? "v" : "") : "v"
      }authorize`
    );
    {
      url.searchParams.set("response_type", "id_token");
      url.searchParams.set(
        "response_mode",
        args.responseMode !== undefined ? args.responseMode : "fragment"
      );
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
    return new Promise((resolve, reject) => {
      if (this.xConnection.readyState !== WebSocket.OPEN) {
        reject(new UWError("CONNECTION_NOT_OPENED"));
        return;
      }
      if (this.xConnection.hasResponseHandler) {
        reject(new UWError("REQUEST_IN_PROGRESS"));
        return;
      }

      this.xConnection.setResponseHandler({
        resolve: (resp) => {
          this.xConnection.setResponseHandler(null);

          if (resp.type !== "signature") {
            reject(
              new UWError(
                "INVALID_RESPONSE",
                `unexpected response type: ${resp.type}`
              )
            );
            return;
          }

          resolve({
            digest: ethers.sha256(ethers.toUtf8Bytes(args.message)),
            signature: resp.value,
          });
        },
        reject: (err) => {
          this.xConnection.setResponseHandler(null);
          reject(err);
        },
      });

      const url = new URL(`${this.unWalletConfig.frontend.baseURL}/x/sign`);
      {
        url.searchParams.set("connectionID", this.xConnection.id);
        url.searchParams.set("clientID", this.clientID);
        url.searchParams.set("message", args.message);
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
    return new Promise((resolve, reject) => {
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
          new UWError("INVALID_REQUEST", "either value or data is required")
        );
        return;
      }

      this.xConnection.setResponseHandler({
        resolve: (resp) => {
          this.xConnection.setResponseHandler(null);

          if (resp.type !== "transactionID") {
            reject(
              new UWError(
                "INVALID_RESPONSE",
                `unexpected response type: ${resp.type}`
              )
            );
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
        `${this.unWalletConfig.frontend.baseURL}/x/sendTransaction`
      );
      {
        url.searchParams.set("connectionID", this.xConnection.id);
        url.searchParams.set("clientID", this.clientID);
        url.searchParams.set("chainID", args.chainID.toString());
        url.searchParams.set("toAddress", args.toAddress);
        url.searchParams.set(
          "value",
          args.value !== undefined ? args.value : "0x0"
        );
        url.searchParams.set(
          "data",
          args.data !== undefined ? args.data : "0x"
        );
        url.searchParams.set("ticketToken", args.ticketToken);
      }

      openWindow(url);
    });
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
    `width=${width},height=${height},left=${left},top=${top}`
  );
}
