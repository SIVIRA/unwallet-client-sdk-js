import { SignedTransaction } from "./transaction";
export declare class DAuth {
    private CHILD_ID;
    private CHILD_ORIGIN;
    private CHILD_URI;
    private RELAYER_ACCOUNT_NAME;
    private ASSETS_CONTRACT_ACCOUNT_NAME;
    private child;
    private routes;
    static init(): Promise<DAuth>;
    private initChild;
    private initRoutes;
    private initEventListener;
    private handleGetWindowSize;
    private handleResizeChild;
    private responseSuccess;
    private responseError;
    private response;
    createAssetTransferTransaction(receiverID: string, assetSourceID: number, quantity: string, memo?: string): Promise<SignedTransaction>;
    signTransaction(contract: string, action: string, data: Uint8Array): Promise<string>;
    private postXAction;
    private closeMessagePorts;
}
