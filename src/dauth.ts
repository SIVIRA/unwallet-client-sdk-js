import { dAuthConfigs } from "./configs";
import { Config, DAuthConfig, MetaTransaction } from "./types";

export class DAuth {
  private config: Config;
  private dAuthConfig: DAuthConfig;

  private ws: WebSocket;
  private connectionID: string;

  private resolve: (result: any) => void;
  private reject: (reason: any) => void;

  constructor(config: Config, dAuthConfig: DAuthConfig, ws: WebSocket) {
    this.config = config;
    this.dAuthConfig = dAuthConfig;
    this.ws = ws;
    this.connectionID = "";
    this.resolve = (result: any) => {};
    this.reject = (reason: any) => {};
  }

  public static init(config: Config): Promise<DAuth> {
    return new Promise((resolve, reject) => {
      if (!config.env) {
        config.env = "prod";
      }
      if (!(config.env in dAuthConfigs)) {
        throw Error("invalid env");
      }

      const dAuthConfig = dAuthConfigs[config.env];

      const ws = new WebSocket(dAuthConfig.wsAPIURL);
      ws.onerror = (event) => {
        reject("websocket connection failed");
      };
      ws.onopen = (event) => {
        dAuth.getConnectionID();
      };
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === "connectionID") {
          dAuth.connectionID = msg.data.value;
          resolve(dAuth);
          return;
        }
        dAuth.handleWSMessage(msg);
      };

      const dAuth = new DAuth(config, dAuthConfig, ws);

      resolve(dAuth);
    });
  }

  private initPromiseArgs(): void {
    this.resolve = (result: string) => {};
    this.reject = (reason: any) => {};
  }

  public authorize(args: {
    responseMode?: string;
    redirectURL: string;
    nonce: string;
  }): void {
    if (!args.responseMode) {
      args.responseMode = "fragment";
    }

    const url = new URL(this.dAuthConfig.authURL);
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

      const url = new URL(`${this.dAuthConfig.baseURL}/x/sign`);
      url.searchParams.set("connectionID", this.connectionID);
      url.searchParams.set("message", args.message);
      this.openWindow(url);
    });
  }

  public signAssetTransfer(args: {
    id: number;
    to: string;
    amount: number;
  }): Promise<MetaTransaction> {
    return new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;

      const url = new URL(`${this.dAuthConfig.baseURL}/x/signAssetTransfer`);
      url.searchParams.set("connectionID", this.connectionID);
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

      const url = new URL(`${this.dAuthConfig.baseURL}/x/createPresentation`);
      url.searchParams.set("connectionID", this.connectionID);
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
          this.reject("canceled");
        } else {
          this.resolve(msg.data.value);
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
