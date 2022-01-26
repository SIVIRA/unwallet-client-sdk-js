import { unWalletConfigs } from "./configs";
import { Config, UnWalletConfig, MetaTransaction } from "./types";

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
          unWallet.connectionID = msg.data.value;
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
  }): void {
    if (!args.responseMode) {
      args.responseMode = "fragment";
    }

    const url = new URL(this.unWalletConfig.authURL);
    url.searchParams.set("response_type", "id_token");
    url.searchParams.set("response_mode", args.responseMode);
    url.searchParams.set("client_id", this.config.clientID);
    url.searchParams.set("scope", "openid email");
    url.searchParams.set("redirect_uri", args.redirectURL);
    url.searchParams.set("nonce", args.nonce);

    location.assign(url.toString());
  }

  public sign(args: { message: string }): Promise<string> {
    return new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;

      const url = new URL(`${this.unWalletConfig.baseURL}/x/sign`);
      url.searchParams.set("connectionID", this.connectionID);
      url.searchParams.set("clientID", this.config.clientID);
      url.searchParams.set("message", args.message);
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
      case "metaTransaction":
      case "presentation":
        if (msg.data.value === null) {
          this.reject!("canceled");
        } else {
          this.resolve!(msg.data.value);
        }
        this.initPromiseArgs();
        break;
    }
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
