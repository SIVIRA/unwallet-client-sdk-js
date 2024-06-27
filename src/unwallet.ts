import { ethers } from "ethers";

import { unWalletConfigs } from "./configs";
import {
  Config,
  UnWalletConfig,
  SignResult,
  SendTransactionResult,
} from "./types";

export class UnWallet {
  private config: Config;
  private unWalletConfig: UnWalletConfig;

  private ws: WebSocket;
  private connectionID: string;

  private resolve: ((result: any) => void) | null = null;
  private reject: ((reason: any) => void) | null = null;

  constructor(config: Config, unWalletConfig: UnWalletConfig, ws: WebSocket) {
    this.config = config;
    this.unWalletConfig = unWalletConfig;

    this.ws = ws;
    this.connectionID = "";

    this.initPromiseArgs();
  }

  private initPromiseArgs(): void {
    this.resolve = (result: any) => {};
    this.reject = (reason: any) => {};
  }

  public static init(config: Config): Promise<UnWallet> {
    return new Promise((resolve, reject) => {
      if (config.env === undefined) {
        config.env = "prod";
      }
      if (!(config.env in unWalletConfigs)) {
        throw Error("invalid env");
      }

      const unWalletConfig = unWalletConfigs[config.env];

      const ws = new WebSocket(unWalletConfig.wsAPIURL);
      {
        ws.onerror = (event) => {
          reject("websocket connection failed");
        };

        ws.onopen = (event) => {
          unWallet.getConnectionID();
        };

        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.type === "connectionID") {
            unWallet.connectionID = msg.value;
            resolve(unWallet);
            return;
          }

          unWallet.handleWSMessage(msg);
        };
      }

      // should be run after ws setup
      const unWallet = new UnWallet(config, unWalletConfig, ws);
    });
  }

  public authorize(args: {
    responseMode?: string;
    redirectURL: string;
    nonce?: string;
    isVirtual?: boolean;
    chainID?: number;
  }): void {
    if (!args.responseMode) {
      args.responseMode = "fragment";
    }

    let url = new URL(
      `${this.unWalletConfig.baseURL}/${
        args.isVirtual === false ? "" : "v"
      }authorize`
    );
    {
      url.searchParams.set("response_type", "id_token");
      url.searchParams.set("response_mode", args.responseMode);
      url.searchParams.set("client_id", this.config.clientID);
      url.searchParams.set("scope", "openid");
      url.searchParams.set("redirect_uri", args.redirectURL);
      if (args.nonce !== undefined) {
        url.searchParams.set("nonce", args.nonce);
      }
      if (args.chainID !== undefined) {
        url.searchParams.set("chain_id", args.chainID.toString());
      }
    }

    location.assign(url.toString());
  }

  public sign(args: { message: string }): Promise<SignResult> {
    return new Promise((resolve, reject) => {
      this.resolve = (sig: string) => {
        resolve({
          digest: ethers.sha256(ethers.toUtf8Bytes(args.message)),
          signature: sig,
        });
      };
      this.reject = reject;

      const url = new URL(`${this.unWalletConfig.baseURL}/x/sign`);
      {
        url.searchParams.set("connectionID", this.connectionID);
        url.searchParams.set("clientID", this.config.clientID);
        url.searchParams.set("message", args.message);
      }

      this.openWindow(url);
    });
  }

  public sendTransaction(args: {
    chainID: number;
    toAddress: string;
    value?: string;
    data?: string;
    ticket: string;
  }): Promise<SendTransactionResult> {
    return new Promise((resolve, reject) => {
      this.resolve = (txID: string) => {
        resolve({ TransactionID: txID });
      };
      this.reject = reject;

      const url = new URL(`${this.unWalletConfig.baseURL}/x/sendTransaction`);
      {
        url.searchParams.set("connectionID", this.connectionID);
        url.searchParams.set("clientID", this.config.clientID);
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
        url.searchParams.set("ticket", args.ticket);
      }

      this.openWindow(url);
    });
  }

  private getConnectionID(): void {
    this.sendWSMessage({
      action: "getConnectionID",
    });
  }

  private sendWSMessage(msg: any): void {
    this.ws.send(JSON.stringify(msg));
  }

  private handleWSMessage(msg: any): void {
    switch (msg.type) {
      case "signature":
        this.resolve!(msg.value);
        break;

      case "metaTransaction":
        this.resolve!(msg.value);
        break;

      case "error":
        switch (msg.value) {
          case "rejected":
            this.reject!("canceled");
            break;

          default:
            throw new Error(msg.value);
        }
        break;

      default:
        throw new Error(`unexpected message type: ${msg.type}`);
    }

    this.initPromiseArgs();
  }

  private openWindow(url: URL): void {
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
}
