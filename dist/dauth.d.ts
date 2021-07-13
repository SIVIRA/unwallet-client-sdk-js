import { Config } from "./config";
export declare class DAuth {
    private config;
    private ws;
    private connectionID;
    private resolve;
    private reject;
    constructor(config: Config, ws: WebSocket);
    static init(args: {
        clientID: string;
        env?: string;
    }): Promise<DAuth>;
    private initPromiseArgs;
    authorize(args: {
        responseMode?: string;
        redirectURL: string;
        nonce: string;
    }): void;
    sign(args: {
        message: string;
    }): Promise<string>;
    createPresentation(args: {
        credential: string;
        challenge: string;
    }): Promise<string>;
    private getConnectionID;
    private sendWSMessage;
    private openWindow;
}
//# sourceMappingURL=dauth.d.ts.map