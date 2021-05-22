"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DAuth = void 0;
const eosjs_1 = require("eosjs");
class DAuth {
    constructor() {
        this.AUTH_URL = "https://auth.id-dev.dauth.world/authorize";
        this.CHILD_ID = "child";
        this.CHILD_ORIGIN = "https://id-dev.dauth.world";
        this.CHILD_URL = "https://id-dev.dauth.world/x";
        this.RELAYER_ACCOUNT_NAME = "pcontroller1";
        this.ASSETS_CONTRACT_ACCOUNT_NAME = "pmultiasset3";
        this.routes = new Map();
    }
    static init(args) {
        return __awaiter(this, void 0, void 0, function* () {
            const dAuth = new DAuth();
            dAuth.clientID = args.clientID;
            yield dAuth.initChild();
            dAuth.initRoutes();
            dAuth.initEventListener();
            return dAuth;
        });
    }
    initChild() {
        return new Promise((resolve, reject) => {
            this.child = document.createElement("iframe");
            this.child.id = this.CHILD_ID;
            this.child.src = this.CHILD_URL;
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
                chan.port1.onmessage = (ev) => {
                    this.closeMessagePorts(chan);
                    if (ev.data.error) {
                        reject(ev.data.error);
                        return;
                    }
                    resolve();
                };
                this.postXAction({
                    method: "initialize",
                    args: {
                        origin: window.origin,
                    },
                }, chan.port2);
            };
            this.child.onerror = (err) => {
                reject(err);
            };
        });
    }
    initRoutes() {
        this.routes.set("getWindowSize", this.handleGetWindowSize);
        this.routes.set("resizeChild", this.handleResizeChild);
    }
    initEventListener() {
        window.addEventListener("message", (ev) => __awaiter(this, void 0, void 0, function* () {
            if (ev.origin !== this.CHILD_ORIGIN) {
                return;
            }
            const port = ev.ports[0];
            if (!port) {
                return;
            }
            const action = ev.data;
            if (!this.routes.has(action.method)) {
                this.responseError(port, "unknown x action");
                return;
            }
            try {
                const result = yield this.routes
                    .get(action.method)
                    .call(this, action.args);
                this.responseSuccess(port, result);
            }
            catch (e) {
                this.responseError(port, e);
            }
        }));
    }
    handleGetWindowSize(args) {
        return __awaiter(this, void 0, void 0, function* () {
            return {
                height: window.innerHeight,
                width: window.innerWidth,
            };
        });
    }
    handleResizeChild(args) {
        return __awaiter(this, void 0, void 0, function* () {
            this.child.style.height = args.height;
            this.child.style.width = args.width;
        });
    }
    responseSuccess(port, result = null) {
        this.response(port, {
            result: result,
        });
    }
    responseError(port, err) {
        this.response(port, {
            error: typeof err === "string" ? err : err.message || JSON.stringify(err),
        });
    }
    response(port, data) {
        port.postMessage(data);
    }
    authorize(args) {
        const authURL = new URL(this.AUTH_URL);
        authURL.searchParams.set("response_type", "id_token");
        authURL.searchParams.set("client_id", this.clientID);
        authURL.searchParams.set("scope", "openid profile");
        authURL.searchParams.set("redirect_uri", args.redirectURL);
        authURL.searchParams.set("nonce", args.nonce);
        location.assign(authURL.toString());
    }
    createAssetTransferTransaction(args) {
        return __awaiter(this, void 0, void 0, function* () {
            const action = "transfer";
            const dataBuf = new eosjs_1.Serialize.SerialBuffer();
            dataBuf.pushName(args.receiverID);
            dataBuf.pushNumberAsUint64(args.assetSourceID);
            dataBuf.pushAsset(args.quantity);
            dataBuf.pushString(args.memo || "");
            const data = dataBuf.asUint8Array();
            const sig = yield this.signTransaction({
                contract: this.ASSETS_CONTRACT_ACCOUNT_NAME,
                action: "transfer",
                data: data,
            });
            return {
                contract: this.ASSETS_CONTRACT_ACCOUNT_NAME,
                action: action,
                data: eosjs_1.Serialize.arrayToHex(data),
                signature: sig,
            };
        });
    }
    signTransaction(args) {
        return new Promise((resolve, reject) => {
            const chan = new MessageChannel();
            chan.port1.onmessage = (ev) => {
                this.closeMessagePorts(chan);
                if (ev.data.error) {
                    reject(ev.data.error);
                    return;
                }
                resolve(ev.data.result.signature);
            };
            this.postXAction({
                method: "signTransaction",
                args: {
                    relayer: this.RELAYER_ACCOUNT_NAME,
                    contract: args.contract,
                    action: args.action,
                    data: args.data,
                },
            }, chan.port2);
        });
    }
    postXAction(action, port) {
        this.child.contentWindow.postMessage(action, this.CHILD_ORIGIN, [port]);
    }
    closeMessagePorts(chan) {
        chan.port1.close();
        chan.port2.close();
    }
}
exports.DAuth = DAuth;
