import { Config, DAuthConfig, MetaTransaction } from "./types";
export declare class DAuth {
    private config;
    private dAuthConfig;
    private ws;
    private connectionID;
    private resolve;
    private reject;
    constructor(config: Config, dAuthConfig: DAuthConfig, ws: WebSocket);
    static init(config: Config): Promise<DAuth>;
    private initPromiseArgs;
    authorize(args: {
        responseMode?: string;
        redirectURL: string;
        nonce: string;
    }): void;
    sign(args: {
        message: string;
    }): Promise<string>;
    signAssetTransfer(args: {
        id: number;
        to: string;
        amount: number;
    }): Promise<MetaTransaction>;
    createPresentation(args: {
        credential: string;
        challenge: string;
    }): Promise<string>;
    private getConnectionID;
    private sendWSMessage;
    private handleWSMessage;
    private openWindow;
}
//# sourceMappingURL=dauth.d.ts.map