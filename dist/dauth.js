"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DAuth = void 0;
const configs_1 = require("./configs");
class DAuth {
    constructor(config, dAuthConfig, ws) {
        this.config = config;
        this.dAuthConfig = dAuthConfig;
        this.ws = ws;
        this.connectionID = "";
        this.resolve = (result) => { };
        this.reject = (reason) => { };
    }
    static init(config) {
        return new Promise((resolve, reject) => {
            if (!config.env) {
                config.env = "prod";
            }
            if (!(config.env in configs_1.dAuthConfigs)) {
                throw Error("invalid env");
            }
            const dAuthConfig = configs_1.dAuthConfigs[config.env];
            const ws = new WebSocket(dAuthConfig.wsAPIURL);
            ws.onerror = (event) => {
                reject("websocket connection failed");
            };
            ws.onopen = (event) => {
                dAuth.getConnectionID();
            };
            ws.onmessage = (event) => {
                const msg = JSON.parse(event.data);
                if (msg.type === "connectionID") {
                    dAuth.connectionID = msg.data.value;
                    resolve(dAuth);
                    return;
                }
                dAuth.handleWSMessage(msg);
            };
            const dAuth = new DAuth(config, dAuthConfig, ws);
            resolve(dAuth);
        });
    }
    initPromiseArgs() {
        this.resolve = (result) => { };
        this.reject = (reason) => { };
    }
    authorize(args) {
        if (!args.responseMode) {
            args.responseMode = "fragment";
        }
        const url = new URL(this.dAuthConfig.authURL);
        url.searchParams.set("response_type", "id_token");
        url.searchParams.set("response_mode", args.responseMode);
        url.searchParams.set("client_id", this.config.clientID);
        url.searchParams.set("scope", "openid email");
        url.searchParams.set("redirect_uri", args.redirectURL);
        url.searchParams.set("nonce", args.nonce);
        location.assign(url.toString());
    }
    sign(args) {
        return new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
            const url = new URL(`${this.dAuthConfig.baseURL}/x/sign`);
            url.searchParams.set("connectionID", this.connectionID);
            url.searchParams.set("message", args.message);
            this.openWindow(url);
        });
    }
    signAssetTransfer(args) {
        return new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
            const url = new URL(`${this.dAuthConfig.baseURL}/x/signAssetTransfer`);
            url.searchParams.set("connectionID", this.connectionID);
            url.searchParams.set("id", args.id.toString());
            url.searchParams.set("to", args.to);
            url.searchParams.set("amount", args.amount.toString());
            this.openWindow(url);
        });
    }
    createPresentation(args) {
        return new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
            const url = new URL(`${this.dAuthConfig.baseURL}/x/createPresentation`);
            url.searchParams.set("connectionID", this.connectionID);
            url.searchParams.set("credential", args.credential);
            url.searchParams.set("challenge", args.challenge);
            this.openWindow(url);
        });
    }
    getConnectionID() {
        this.sendWSMessage({
            action: "getConnectionID",
        });
    }
    sendWSMessage(msg) {
        this.ws.send(JSON.stringify(msg));
    }
    handleWSMessage(msg) {
        switch (msg.type) {
            case "signature":
            case "metaTransaction":
            case "presentation":
                if (msg.data.value === null) {
                    this.reject("canceled");
                }
                else {
                    this.resolve(msg.data.value);
                }
                this.initPromiseArgs();
                break;
        }
    }
    openWindow(url) {
        const width = screen.width / 2;
        const height = screen.height;
        const left = screen.width / 4;
        const top = 0;
        window.open(url.toString(), "_blank", `width=${width},height=${height},left=${left},top=${top}`);
    }
}
exports.DAuth = DAuth;
