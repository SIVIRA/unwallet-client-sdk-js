"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DAuth = void 0;
var configs = new Map();
configs.set("prod", {
    clientID: "",
    dAuth: {
        baseURL: "https://id.dauth.world",
        authURL: "https://id.dauth.world/authorize",
        wsAPIURL: "wss://ws-api.admin.id.dauth.world",
    },
});
configs.set("dev", {
    clientID: "",
    dAuth: {
        baseURL: "https://id-dev.dauth.world",
        authURL: "https://auth.id-dev.dauth.world/authorize",
        wsAPIURL: "wss://ws-api.admin.id-dev.dauth.world",
    },
});
var DAuth = /** @class */ (function () {
    function DAuth(config, ws) {
        this.config = config;
        this.ws = ws;
        this.connectionID = "";
        this.resolve = function (result) { };
        this.reject = function (reason) { };
    }
    DAuth.init = function (args) {
        return new Promise(function (resolve, reject) {
            if (!args.env) {
                args.env = "prod";
            }
            if (!configs.has(args.env)) {
                throw Error("invalid env");
            }
            var config = configs.get(args.env);
            config.clientID = args.clientID;
            var dAuth = new DAuth(config, new WebSocket(config.dAuth.wsAPIURL));
            dAuth.ws.onerror = function (event) {
                reject("websocket connection failed");
            };
            dAuth.ws.onmessage = function (event) {
                var msg = JSON.parse(event.data);
                switch (msg.type) {
                    case "connectionID":
                        dAuth.connectionID = msg.data.value;
                        resolve(dAuth);
                        break;
                    case "signature":
                        if (!!msg.data.value) {
                            dAuth.resolve(msg.data.value);
                        }
                        else {
                            dAuth.reject("canceled");
                        }
                        dAuth.initPromiseArgs();
                        break;
                    case "presentation":
                        if (!!msg.data.value) {
                            dAuth.resolve(msg.data.value);
                        }
                        else {
                            dAuth.reject("canceled");
                        }
                        dAuth.initPromiseArgs();
                        break;
                }
            };
            dAuth.ws.onopen = function (event) {
                dAuth.getConnectionID(dAuth.ws);
            };
        });
    };
    DAuth.prototype.initPromiseArgs = function () {
        this.resolve = function (result) { };
        this.reject = function (reason) { };
    };
    DAuth.prototype.authorize = function (args) {
        if (!args.responseMode) {
            args.responseMode = "fragment";
        }
        var url = new URL(this.config.dAuth.authURL);
        url.searchParams.set("response_type", "id_token");
        url.searchParams.set("response_mode", args.responseMode);
        url.searchParams.set("client_id", this.config.clientID);
        url.searchParams.set("scope", "openid email");
        url.searchParams.set("redirect_uri", args.redirectURL);
        url.searchParams.set("nonce", args.nonce);
        location.assign(url.toString());
    };
    DAuth.prototype.sign = function (args) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.resolve = resolve;
            _this.reject = reject;
            var url = new URL(_this.config.dAuth.baseURL + "/x/sign");
            url.searchParams.set("connectionID", _this.connectionID);
            url.searchParams.set("message", args.message);
            _this.openWindow(url);
        });
    };
    DAuth.prototype.createPresentation = function (args) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.resolve = resolve;
            _this.reject = reject;
            var url = new URL(_this.config.dAuth.baseURL + "/x/createPresentation");
            url.searchParams.set("connectionID", _this.connectionID);
            url.searchParams.set("credentialType", args.credentialType);
            url.searchParams.set("challenge", args.challenge);
            _this.openWindow(url);
        });
    };
    DAuth.prototype.getConnectionID = function (ws) {
        this.sendWSMessage(ws, {
            action: "getConnectionID",
        });
    };
    DAuth.prototype.sendWSMessage = function (ws, message) {
        ws.send(JSON.stringify(message));
    };
    DAuth.prototype.openWindow = function (url) {
        var width = 480;
        var height = 480;
        var left = (screen.width - width) / 2;
        var top = (screen.height - height) / 2;
        window.open(url.toString(), "_blank", "width=" + width + ",height=" + height + ",left=" + left + ",top=" + top);
    };
    return DAuth;
}());
exports.DAuth = DAuth;
