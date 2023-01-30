import { ethers } from "ethers";

import { unWalletConfigs } from "./configs";
import {
  Config,
  UnWalletConfig,
  DigestAndSignature,
  MetaTransaction,
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

      // should be run after ws setup
      const unWallet = new UnWallet(config, unWalletConfig, ws);
    });
  }

  public authorize(args: {
    responseMode?: string;
    redirectURL: string;
    nonce: string;
    isVirtual?: boolean;
  }): void {
    if (!args.responseMode) {
      args.responseMode = "fragment";
    }

    let url: URL;
    if (args.isVirtual === true) {
      url = new URL(`${this.unWalletConfig.baseURL}/vauthorize`);
    } else {
      url = new URL(`${this.unWalletConfig.baseURL}/authorize`);
    }
    url.searchParams.set("response_type", "id_token");
    url.searchParams.set("response_mode", args.responseMode);
    url.searchParams.set("client_id", this.config.clientID);
    url.searchParams.set("scope", "openid email");
    url.searchParams.set("redirect_uri", args.redirectURL);
    url.searchParams.set("nonce", args.nonce);

    location.assign(url.toString());
  }

  public sign(args: { message: string }): Promise<DigestAndSignature> {
    return new Promise((resolve, reject) => {
      this.resolve = (sig: string) => {
        resolve({
          digest: ethers.utils.sha256(ethers.utils.toUtf8Bytes(args.message)),
          signature: sig,
        });
      };
      this.reject = reject;

      const url = new URL(`${this.unWalletConfig.baseURL}/x/sign`);
      url.searchParams.set("connectionID", this.connectionID);
      url.searchParams.set("clientID", this.config.clientID);
      url.searchParams.set("message", args.message);

      this.openWindow(url);
    });
  }

  public signTransaction(args: {
    to: string;
    value?: string;
    data?: string;
  }): Promise<MetaTransaction> {
    return new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;

      const url = new URL(`${this.unWalletConfig.baseURL}/x/signTransaction`);
      url.searchParams.set("connectionID", this.connectionID);
      url.searchParams.set("clientID", this.config.clientID);
      url.searchParams.set("transaction", JSON.stringify(args));

      this.openWindow(url);
    });
  }

  public signTokenTransfer(args: {
    id: number;
    to: string;
    amount: number;
  }): Promise<MetaTransaction> {
    return new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;

      const url = new URL(`${this.unWalletConfig.baseURL}/x/signTokenTransfer`);
      url.searchParams.set("connectionID", this.connectionID);
      url.searchParams.set("clientID", this.config.clientID);
      url.searchParams.set("id", args.id.toString());
      url.searchParams.set("to", args.to);
      url.searchParams.set("amount", args.amount.toString());

      this.openWindow(url);
    });
  }

  public createPresentation(args: {
    credential: string;
    challenge: string;
  }): Promise<string> {
    return new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;

      const url = new URL(
        `${this.unWalletConfig.baseURL}/x/createPresentation`
      );
      url.searchParams.set("connectionID", this.connectionID);
      url.searchParams.set("clientID", this.config.clientID);
      url.searchParams.set("credential", args.credential);
      url.searchParams.set("challenge", args.challenge);

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

      case "presentation":
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
        throw new Error(`unknown message type: ${msg.type}`);
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
