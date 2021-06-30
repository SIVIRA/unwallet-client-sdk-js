import { Config } from "./config";

const configs = new Map<string, Config>();
configs.set("prod", {
  clientID: "",
  dAuth: {
    baseURL: "https://id.dauth.world",
    authURL: "https://auth.id.dauth.world/authorize",
    wsAPIURL: "wss://ws-api.admin.id.dauth.world",
  },
});
configs.set("dev", {
  clientID: "",
  dAuth: {
    baseURL: "https://id-dev.dauth.world",
    authURL: "https://auth.id-dev.dauth.world/authorize",
    wsAPIURL: "wss://ws-api.admin.id-dev.dauth.world",
  },
});

export class DAuth {
  private config: Config;

  constructor(args: { clientID: string; env?: string }) {
    if (!args.env) {
      args.env = "prod";
    }
    if (!configs.has(args.env)) {
      throw Error("invalid env");
    }

    this.config = configs.get(args.env)!;
    this.config.clientID = args.clientID;
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
    url.searchParams.set("scope", "openid profile");
    url.searchParams.set("redirect_uri", args.redirectURL);
    url.searchParams.set("nonce", args.nonce);

    location.assign(url.toString());
  }

  public sign(args: { message: string }): Promise<string> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.config.dAuth.wsAPIURL);
      ws.onerror = (event) => {
        reject("websocket connection failed");
      };
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case "connectionID":
            const url = new URL(`${this.config.dAuth.baseURL}/x/sign`);
            url.searchParams.set("connectionID", msg.data.value);
            url.searchParams.set("message", args.message);
            this.openWindow(url);
            break;

          case "signature":
            ws.close();
            if (!msg.data.value) {
              reject("canceled");
              break;
            }
            resolve(msg.data.value);
            break;
        }
      };
      ws.onopen = (event) => {
        this.getConnectionID(ws);
      };
    });
  }

  public createPresentation(args: {
    credentialType: string;
    challenge: string;
  }): Promise<string> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.config.dAuth.wsAPIURL);
      ws.onerror = (event) => {
        reject("websocket connection failed");
      };
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case "connectionID":
            const url = new URL(
              `${this.config.dAuth.baseURL}/x/createPresentation`
            );
            url.searchParams.set("connectionID", msg.data.value);
            url.searchParams.set("credentialType", args.credentialType);
            url.searchParams.set("challenge", args.challenge);
            this.openWindow(url);
            break;

          case "presentation":
            ws.close();
            if (!msg.data.value) {
              reject("canceled");
              break;
            }
            resolve(msg.data.value);
            break;
        }
      };
      ws.onopen = (event) => {
        this.getConnectionID(ws);
      };
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
