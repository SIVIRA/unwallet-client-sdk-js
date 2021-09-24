import configs from "./configs";
import { Config, MetaTransaction } from "./types";

export class DAuth {
  private config: Config;

  private ws: WebSocket;
  private connectionID: string;

  private resolve: (result: any) => void;
  private reject: (reason: any) => void;

  constructor(config: Config, ws: WebSocket) {
    this.config = config;
    this.ws = ws;
    this.connectionID = "";
    this.resolve = (result: any) => {};
    this.reject = (reason: any) => {};
  }

  public static init(args: { clientID: string; env?: string }): Promise<DAuth> {
    return new Promise((resolve, reject) => {
      if (!args.env) {
        args.env = "prod";
      }
      if (!(args.env in configs)) {
        throw Error("invalid env");
      }

      const config = configs[args.env];
      config.clientID = args.clientID;

      const dAuth = new DAuth(config, new WebSocket(config.dAuth.wsAPIURL));

      dAuth.ws.onerror = (event) => {
        reject("websocket connection failed");
      };
      dAuth.ws.onopen = (event) => {
        dAuth.getConnectionID();
      };
      dAuth.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === "connectionID") {
          dAuth.connectionID = msg.data.value;
          resolve(dAuth);
          return;
        }
        dAuth.handleWSMessage(msg);
      };
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

    const url = new URL(this.config.dAuth.authURL);
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

      const url = new URL(`${this.config.dAuth.baseURL}/x/sign`);
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

      const url = new URL(`${this.config.dAuth.baseURL}/x/signAssetTransfer`);
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

      const url = new URL(`${this.config.dAuth.baseURL}/x/createPresentation`);
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
    const width = 480;
    const height = 480;
    const left = (screen.width - width) / 2;
    const top = (screen.height - height) / 2;

    window.open(
      url.toString(),
      "_blank",
      `width=${width},height=${height},left=${left},top=${top}`
    );
  }
}
