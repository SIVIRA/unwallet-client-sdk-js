import { Config } from "./config";

const configs = new Map<string, Config>();
configs.set("prod", {
  clientID: "",
  dAuth: {
    baseURL: "https://id.dauth.world",
    authURL: "https://id.dauth.world/authorize",
    wsAPIURL: "wss://ws-api.admin.id.dauth.world",
  },
});
configs.set("dev", {
  clientID: "",
  dAuth: {
    baseURL: "https://id-dev.dauth.world",
    authURL: "https://id-dev.dauth.world/authorize",
    wsAPIURL: "wss://ws-api.admin.id-dev.dauth.world",
  },
});

export class DAuth {
  private config: Config;
  private ws: WebSocket;
  private connectionID: string;
  private resolve: (result: string) => void;
  private reject: (reason: any) => void;

  constructor(config: Config, ws: WebSocket) {
    this.config = config;
    this.ws = ws;
    this.connectionID = "";
    this.resolve = (result: string) => {};
    this.reject = (reason: any) => {};
  }

  public static init(args: { clientID: string; env?: string }): Promise<DAuth> {
    return new Promise((resolve, reject) => {
      if (!args.env) {
        args.env = "prod";
      }
      if (!configs.has(args.env)) {
        throw Error("invalid env");
      }

      const config = configs.get(args.env)!;
      config.clientID = args.clientID;

      const dAuth = new DAuth(config, new WebSocket(config.dAuth.wsAPIURL));

      dAuth.ws.onerror = (event) => {
        reject("websocket connection failed");
      };
      dAuth.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case "connectionID":
            dAuth.connectionID = msg.data.value;
            resolve(dAuth);
            break;

          case "signature":
            if (!!msg.data.value) {
              dAuth.resolve(msg.data.value);
            } else {
              dAuth.reject("canceled");
            }
            dAuth.initPromiseArgs();
            break;

          case "presentation":
            if (!!msg.data.value) {
              dAuth.resolve(msg.data.value);
            } else {
              dAuth.reject("canceled");
            }
            dAuth.initPromiseArgs();
            break;
        }
      };
      dAuth.ws.onopen = (event) => {
        dAuth.getConnectionID(dAuth.ws);
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

  private getConnectionID(ws: WebSocket): void {
    this.sendWSMessage(ws, {
      action: "getConnectionID",
    });
  }

  private sendWSMessage(ws: WebSocket, message: any): void {
    ws.send(JSON.stringify(message));
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
