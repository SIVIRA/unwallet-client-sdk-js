export declare class DAuth {
    private config;
    private x;
    private routes;
    static init(args: {
        clientID: string;
        env?: string;
    }): Promise<DAuth>;
    private initChild;
    private initRoutes;
    private initEventListener;
    private handleGetWindowSize;
    private handleResizeX;
    private responseSuccess;
    private responseError;
    private response;
    authorize(args: {
        responseMode?: string;
        redirectURL: string;
        nonce: string;
    }): void;
    createPresentation(args: {
        credentialType: string;
        challenge: string;
    }): Promise<string>;
    sign(args: {
        message: string;
    }): Promise<string>;
    private postXAction;
    private closeMessagePorts;
}
