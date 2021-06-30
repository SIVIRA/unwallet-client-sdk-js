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

    const authURL = new URL(this.config.dAuth.authURL);

    authURL.searchParams.set("response_type", "id_token");
    authURL.searchParams.set("response_mode", args.responseMode);
    authURL.searchParams.set("client_id", this.config.clientID);
    authURL.searchParams.set("scope", "openid profile");
    authURL.searchParams.set("redirect_uri", args.redirectURL);
    authURL.searchParams.set("nonce", args.nonce);

    location.assign(authURL.toString());
  }

  public sign(args: { message: string }): Promise<string> {
    return new Promise((resolve, reject) => {
      // TODO
      resolve("");
    });
  }

  public createPresentation(args: {
    credentialType: string;
    challenge: string;
  }): Promise<string> {
    return new Promise((resolve, reject) => {
      // TODO
      resolve("");
    });
  }
}
