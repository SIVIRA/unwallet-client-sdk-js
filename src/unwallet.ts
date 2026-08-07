import {
  BaseError,
  Hash,
  Hex,
  hashTypedData,
  toBytes,
  sha256,
  validateTypedData,
} from "viem";

import { Env, Config, UnWalletConfig, envToUnWalletConfig } from "./config";
import { EIP712TypedData } from "./eip712";
import { UWError } from "./error";
import {
  XConnection,
  XResponseType,
  XResponseValue,
  newUnexpectedXResponseTypeError,
} from "./x";

export type AuthorizationResponseMode = "fragment" | "form_post";

export interface SignResult {
  digest: Hash;
  signature: Hex;
}

export interface SendTransactionResult {
  transactionID: string;
}

export class UnWallet {
  private readonly env: Env;
  private readonly clientID: string;
  private readonly xConnection: XConnection;

  constructor(args: {
    readonly env: Env;
    readonly clientID: string;
    readonly xConnection: XConnection;
  }) {
    this.env = args.env;
    this.clientID = args.clientID;
    this.xConnection = args.xConnection;
  }

  public static async init(config: Config): Promise<UnWallet> {
    const env = config.env ?? "prod";

    return new UnWallet({
      env: env,
      clientID: config.clientID,
      xConnection: await XConnection.init(envToUnWalletConfig[env].xAPI),
    });
  }

  private get unWalletConfig(): UnWalletConfig {
    return envToUnWalletConfig[this.env];
  }

  public authorize(args: {
    readonly responseMode?: AuthorizationResponseMode;
    readonly redirectURL: string;
    readonly nonce?: string;
    readonly isVirtual?: boolean;
    readonly chainID?: number;
  }): void {
    const url = new URL(
      `/${args.isVirtual === false ? "" : "v"}authorize`,
      this.unWalletConfig.frontend.origin,
    );
    {
      url.searchParams.set("response_type", "id_token");
      url.searchParams.set("response_mode", args.responseMode ?? "fragment");
      url.searchParams.set("client_id", this.clientID);
      url.searchParams.set("scope", "openid");
      url.searchParams.set("redirect_uri", args.redirectURL);
      if (args.nonce !== undefined) {
        url.searchParams.set("nonce", args.nonce);
      }
      if (args.chainID !== undefined) {
        url.searchParams.set("chain_id", args.chainID.toString());
      }
    }

    location.assign(url);
  }

  public async sign(args: {
    readonly message: string;
    readonly ticketToken: string;
  }): Promise<SignResult> {
    const digest = sha256(toBytes(args.message));

    const signature = await this.request({
      responseType: "signature",
      path: "/x/sign",
      params: {
        message: args.message,
        ticketToken: args.ticketToken,
      },
    });

    return { digest, signature };
  }

  public async signEIP712TypedData(args: {
    readonly typedData: EIP712TypedData;
    readonly ticketToken: string;
  }): Promise<SignResult> {
    const { EIP712Domain: _, ...typedDataTypes } = args.typedData.types;
    const typedData = {
      ...args.typedData,
      types: typedDataTypes,
    };

    try {
      validateTypedData(typedData);
    } catch (e) {
      throw new UWError(
        "INVALID_REQUEST",
        `invalid typed data: ${e instanceof BaseError ? e.shortMessage : String(e)}`,
      );
    }

    const digest = hashTypedData(typedData);

    const signature = await this.request({
      responseType: "signature",
      path: "/x/signEIP712TypedData",
      params: {
        typedData: JSON.stringify(args.typedData),
        ticketToken: args.ticketToken,
      },
    });

    return { digest, signature };
  }

  public async sendTransaction(args: {
    readonly chainID: number;
    readonly toAddress: string;
    readonly value?: string;
    readonly data?: string;
    readonly ticketToken: string;
  }): Promise<SendTransactionResult> {
    if (args.value === undefined && args.data === undefined) {
      throw new UWError("INVALID_REQUEST", "either value or data is required");
    }

    const transactionID = await this.request({
      responseType: "transactionID",
      path: "/x/sendTransaction",
      params: {
        chainID: args.chainID.toString(),
        toAddress: args.toAddress,
        value: args.value ?? "0x0",
        data: args.data ?? "0x",
        ticketToken: args.ticketToken,
      },
    });

    return { transactionID };
  }

  private request<T extends XResponseType>(args: {
    readonly responseType: T;
    readonly path: string;
    readonly params: Record<string, string>;
  }): Promise<XResponseValue<T>> {
    return new Promise<XResponseValue<T>>((resolve, reject) => {
      if (this.xConnection.readyState !== WebSocket.OPEN) {
        reject(new UWError("CONNECTION_NOT_OPENED"));
        return;
      }
      if (this.xConnection.hasResponseHandler) {
        reject(new UWError("REQUEST_IN_PROGRESS"));
        return;
      }

      this.xConnection.setResponseHandler({
        resolve: (resp) => {
          this.xConnection.setResponseHandler(null);

          if (resp.type !== args.responseType) {
            reject(newUnexpectedXResponseTypeError(resp));
            return;
          }

          // safe because `xResponseSchema` validates the type/value pairing
          resolve(resp.value as XResponseValue<T>);
        },
        reject: (err) => {
          this.xConnection.setResponseHandler(null);
          reject(err);
        },
      });

      const url = new URL(args.path, this.unWalletConfig.frontend.origin);
      {
        url.searchParams.set("connectionID", this.xConnection.id);
        url.searchParams.set("clientID", this.clientID);
        for (const [key, value] of Object.entries(args.params)) {
          url.searchParams.set(key, value);
        }
      }

      openWindow(url);
    });
  }

  public close(): void {
    this.xConnection.close();
  }
}

function openWindow(url: URL): void {
  const width = screen.width / 2;
  const height = screen.height;
  const left = screen.width / 4;
  const top = 0;

  window.open(
    url.toString(),
    "_blank",
    `width=${width},height=${height},left=${left},top=${top}`,
  );
}
