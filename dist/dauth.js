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
const configs = new Map();
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
class DAuth {
    constructor() {
        this.routes = new Map();
    }
    static init(args) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!args.env) {
                args.env = "prod";
            }
            if (!configs.has(args.env)) {
                throw Error("invalid env");
            }
            const dAuth = new DAuth();
            dAuth.config = configs.get(args.env);
            dAuth.config.clientID = args.clientID;
            yield dAuth.initChild();
            dAuth.initRoutes();
            dAuth.initEventListener();
            return dAuth;
        });
    }
    initChild() {
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
            this.x.onerror = (err) => {
                reject(err);
            };
        });
    }
    initRoutes() {
        this.routes.set("getWindowSize", this.handleGetWindowSize);
        this.routes.set("resizeX", this.handleResizeX);
    }
    initEventListener() {
        window.addEventListener("message", (ev) => __awaiter(this, void 0, void 0, function* () {
            if (ev.origin !== this.config.x.origin) {
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
    handleResizeX(args) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.ngRenderer) {
                this.ngRenderer.setStyle(this.x, "height", `${args.height}px`);
                this.ngRenderer.setStyle(this.x, "width", `${args.width}px`);
            }
            else {
                this.x.style.height = args.height;
                this.x.style.width = args.width;
            }
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
    setNgRenderer(ngRenderer) {
        this.ngRenderer = ngRenderer;
    }
    authorize(args) {
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
    createPresentation(args) {
        return new Promise((resolve, reject) => {
            const chan = new MessageChannel();
            chan.port1.onmessage = (ev) => {
                this.closeMessagePorts(chan);
                if (ev.data.error) {
                    reject(ev.data.error);
                    return;
                }
                resolve(ev.data.result.presentation);
            };
            this.postXAction({
                method: "createPresentation",
                args: args,
            }, chan.port2);
        });
    }
    sign(args) {
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
                method: "sign",
                args: args,
            }, chan.port2);
        });
    }
    postXAction(action, port) {
        this.x.contentWindow.postMessage(action, this.config.x.origin, [port]);
    }
    closeMessagePorts(chan) {
        chan.port1.close();
        chan.port2.close();
    }
}
exports.DAuth = DAuth;
