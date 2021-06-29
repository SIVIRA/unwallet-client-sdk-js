import { Renderer2 } from "@angular/core";

import { Config } from "./config";
import { XAction } from "./x-action";

const configs = new Map<string, Config>();
configs.set("prod", {
  clientID: "",
  auth: {
    url: "https://auth.id.dauth.world/authorize",
  },
  x: {
    origin: "https://id.dauth.world",
    url: "https://id.dauth.world/x",
    elementID: "x",
  },
});
configs.set("dev", {
  clientID: "",
  auth: {
    url: "https://auth.id-dev.dauth.world/authorize",
  },
  x: {
    origin: "https://id-dev.dauth.world",
    url: "https://id-dev.dauth.world/x",
    elementID: "x",
  },
});

export class DAuth {
  private config: Config;
  private x: HTMLIFrameElement;
  private routes = new Map<string, (args: any) => Promise<any>>();

  private ngRenderer: Renderer2;

  public static async init(args: {
    clientID: string;
    env?: string;
  }): Promise<DAuth> {
    if (!args.env) {
      args.env = "prod";
    }
    if (!configs.has(args.env)) {
      throw Error("invalid env");
    }

    const dAuth = new DAuth();
    dAuth.config = configs.get(args.env)!;
    dAuth.config.clientID = args.clientID;

    await dAuth.initChild();
    dAuth.initRoutes();
    dAuth.initEventListener();

    return dAuth;
  }

  private initChild(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.x = document.createElement("iframe");

      this.x.id = this.config.x.elementID;
      this.x.src = this.config.x.url;
      this.x.style.bottom = "0";
      this.x.style.height = "0";
      this.x.style.position = "fixed";
      this.x.style.right = "0";
      this.x.style.width = "0";
      this.x.style.zIndex = "2147483647";
      this.x.setAttribute("frameborder", "0");
      this.x.setAttribute("scrolling", "no");

      document.body.appendChild(this.x);

      this.x.onload = () => {
        const chan = new MessageChannel();
        chan.port1.onmessage = (ev: MessageEvent) => {
          this.closeMessagePorts(chan);
          if (ev.data.error) {
            reject(ev.data.error);
            return;
          }
          resolve();
        };
        this.postXAction(
          {
            method: "initialize",
            args: {
              origin: window.origin,
            },
          },
          chan.port2
        );
      };

      this.x.onerror = (err: string | Event) => {
        reject(err);
      };
    });
  }

  private initRoutes(): void {
    this.routes.set("getWindowSize", this.handleGetWindowSize);
    this.routes.set("resizeX", this.handleResizeX);
  }

  private initEventListener(): void {
    window.addEventListener("message", async (ev: MessageEvent) => {
      if (ev.origin !== this.config.x.origin) {
        return;
      }
      const port = ev.ports[0];
      if (!port) {
        return;
      }
      const action = <XAction>ev.data;
      if (!this.routes.has(action.method)) {
        this.responseError(port, "unknown x action");
        return;
      }
      try {
        const result = await this.routes
          .get(action.method)!
          .call(this, action.args);
        this.responseSuccess(port, result);
      } catch (e) {
        this.responseError(port, e);
      }
    });
  }

  private async handleGetWindowSize(args: any): Promise<any> {
    return {
      height: window.innerHeight,
      width: window.innerWidth,
    };
  }

  private async handleResizeX(args: any): Promise<any> {
    if (this.ngRenderer) {
      this.ngRenderer.setStyle(this.x, "height", `${args.height}px`);
      this.ngRenderer.setStyle(this.x, "width", `${args.width}px`);
    } else {
      this.x.style.height = args.height;
      this.x.style.width = args.width;
    }
  }

  private responseSuccess(port: MessagePort, result: any = null): void {
    this.response(port, {
      result: result,
    });
  }

  private responseError(port: MessagePort, err: any): void {
    this.response(port, {
      error: typeof err === "string" ? err : err.message || JSON.stringify(err),
    });
  }

  private response(port: MessagePort, data: any): void {
    port.postMessage(data);
  }

  public setNgRenderer(ngRenderer: Renderer2) {
    this.ngRenderer = ngRenderer;
  }

  public authorize(args: {
    responseMode?: string;
    redirectURL: string;
    nonce: string;
  }): void {
    if (!args.responseMode) {
      args.responseMode = "fragment";
    }

    const authURL = new URL(this.config.auth.url);

    authURL.searchParams.set("response_type", "id_token");
    authURL.searchParams.set("response_mode", args.responseMode);
    authURL.searchParams.set("client_id", this.config.clientID);
    authURL.searchParams.set("scope", "openid profile");
    authURL.searchParams.set("redirect_uri", args.redirectURL);
    authURL.searchParams.set("nonce", args.nonce);

    location.assign(authURL.toString());
  }

  public createPresentation(args: {
    credentialType: string;
    challenge: string;
  }): Promise<string> {
    return new Promise((resolve, reject) => {
      const chan = new MessageChannel();
      chan.port1.onmessage = (ev: MessageEvent) => {
        this.closeMessagePorts(chan);
        if (ev.data.error) {
          reject(ev.data.error);
          return;
        }
        resolve(ev.data.result.presentation);
      };
      this.postXAction(
        {
          method: "createPresentation",
          args: args,
        },
        chan.port2
      );
    });
  }

  public sign(args: { message: string }): Promise<string> {
    return new Promise((resolve, reject) => {
      const chan = new MessageChannel();
      chan.port1.onmessage = (ev: MessageEvent) => {
        this.closeMessagePorts(chan);
        if (ev.data.error) {
          reject(ev.data.error);
          return;
        }
        resolve(ev.data.result.signature);
      };
      this.postXAction(
        {
          method: "sign",
          args: args,
        },
        chan.port2
      );
    });
  }

  private postXAction(action: XAction, port: MessagePort): void {
    this.x.contentWindow!.postMessage(action, this.config.x.origin, [port]);
  }

  private closeMessagePorts(chan: MessageChannel) {
    chan.port1.close();
    chan.port2.close();
  }
}
