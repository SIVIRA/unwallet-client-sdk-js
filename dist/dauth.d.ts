import { Renderer2 } from "@angular/core";
export declare class DAuth {
    private config;
    private x;
    private routes;
    private ngRenderer;
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
    setNgRenderer(ngRenderer: Renderer2): void;
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
