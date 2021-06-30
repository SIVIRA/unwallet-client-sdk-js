"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DAuth = void 0;
var configs = new Map();
configs.set("prod", {
    clientID: "",
    dAuth: {
        baseURL: "https://id.dauth.world",
        authURL: "https://auth.id.dauth.world/authorize",
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
    function DAuth(args) {
        if (!args.env) {
            args.env = "prod";
        }
        if (!configs.has(args.env)) {
            throw Error("invalid env");
        }
        this.config = configs.get(args.env);
        this.config.clientID = args.clientID;
    }
    DAuth.prototype.authorize = function (args) {
        if (!args.responseMode) {
            args.responseMode = "fragment";
        }
        var authURL = new URL(this.config.dAuth.authURL);
        authURL.searchParams.set("response_type", "id_token");
        authURL.searchParams.set("response_mode", args.responseMode);
        authURL.searchParams.set("client_id", this.config.clientID);
        authURL.searchParams.set("scope", "openid profile");
        authURL.searchParams.set("redirect_uri", args.redirectURL);
        authURL.searchParams.set("nonce", args.nonce);
        location.assign(authURL.toString());
    };
    DAuth.prototype.sign = function (args) {
        return new Promise(function (resolve, reject) {
            // TODO
            resolve("");
        });
    };
    DAuth.prototype.createPresentation = function (args) {
        return new Promise(function (resolve, reject) {
            // TODO
            resolve("");
        });
    };
    return DAuth;
}());
exports.DAuth = DAuth;
