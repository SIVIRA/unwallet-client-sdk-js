export declare class DAuth {
    private config;
    constructor(args: {
        clientID: string;
        env?: string;
    });
    authorize(args: {
        responseMode?: string;
        redirectURL: string;
        nonce: string;
    }): void;
    sign(args: {
        message: string;
    }): Promise<string>;
    createPresentation(args: {
        credentialType: string;
        challenge: string;
    }): Promise<string>;
    private getConnectionID;
    private sendWSMessage;
    private openWindow;
}
//# sourceMappingURL=dauth.d.ts.map