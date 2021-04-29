import { Serialize } from "eosjs";

import { SignedTransaction } from "./transaction";
import { XAction } from "./x-action";

export class DAuth {
  private CHILD_ID = "child";
  private CHILD_ORIGIN = "https://id.dauth.world";
  private CHILD_URI = "https://id.dauth.world/x";

  private RELAYER_ACCOUNT_NAME = "pcontroller1";
  private ASSETS_CONTRACT_ACCOUNT_NAME = "pmultiasset3";

  private child: HTMLIFrameElement;
  private routes = new Map<string, (args: any) => Promise<any>>();

  public static async init(): Promise<DAuth> {
    const dAuth = new DAuth();

    await dAuth.initChild();
    dAuth.initRoutes();
    dAuth.initEventListener();

    return dAuth;
  }

  private initChild(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.child = document.createElement("iframe");
      this.child.id = this.CHILD_ID;
      this.child.src = this.CHILD_URI;
      this.child.style.bottom = "0";
      this.child.style.height = "0";
      this.child.style.position = "fixed";
      this.child.style.right = "0";
      this.child.style.width = "0";
      this.child.style.zIndex = "2147483647";
      this.child.setAttribute("frameborder", "0");
      this.child.setAttribute("scrolling", "no");
      document.body.appendChild(this.child);
      this.child.onload = () => {
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
      this.child.onerror = (err: string | Event) => {
        reject(err);
      };
    });
  }

  private initRoutes(): void {
    this.routes.set("getWindowSize", this.handleGetWindowSize);
    this.routes.set("resizeChild", this.handleResizeChild);
  }

  private initEventListener(): void {
    window.addEventListener("message", async (ev: MessageEvent) => {
      if (ev.origin !== this.CHILD_ORIGIN) {
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

  private async handleResizeChild(args: any): Promise<any> {
    this.child.style.height = args.height;
    this.child.style.width = args.width;
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

  public async createAssetTransferTransaction(
    receiverID: string,
    assetSourceID: number,
    quantity: string,
    memo: string = ""
  ): Promise<SignedTransaction> {
    const action = "transfer";

    const dataBuf = new Serialize.SerialBuffer();
    dataBuf.pushName(receiverID);
    dataBuf.pushNumberAsUint64(assetSourceID);
    dataBuf.pushAsset(quantity);
    dataBuf.pushString(memo);
    const data = dataBuf.asUint8Array();

    const sig = await this.signTransaction(
      this.ASSETS_CONTRACT_ACCOUNT_NAME,
      "transfer",
      data
    );

    return {
      contract: this.ASSETS_CONTRACT_ACCOUNT_NAME,
      action: action,
      data: Serialize.arrayToHex(data),
      signature: sig,
    };
  }

  public signTransaction(
    contract: string,
    action: string,
    data: Uint8Array
  ): Promise<string> {
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
          method: "signTransaction",
          args: {
            relayer: this.RELAYER_ACCOUNT_NAME,
            contract: contract,
            action: action,
            data: data,
          },
        },
        chan.port2
      );
    });
  }

  private postXAction(action: XAction, port: MessagePort): void {
    this.child.contentWindow!.postMessage(action, this.CHILD_ORIGIN, [port]);
  }

  private closeMessagePorts(chan: MessageChannel) {
    chan.port1.close();
    chan.port2.close();
  }
}
