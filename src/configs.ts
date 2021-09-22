import { Config } from "./types";

const configs: { [env: string]: Config } = {
  prod: {
    clientID: "",
    dAuth: {
      baseURL: "https://id.dauth.world",
      authURL: "https://id.dauth.world/authorize",
      wsAPIURL: "wss://ws-api.admin.id.dauth.world",
    },
  },
  dev: {
    clientID: "",
    dAuth: {
      baseURL: "https://id-dev.dauth.world",
      authURL: "https://id-dev.dauth.world/authorize",
      wsAPIURL: "wss://ws-api.admin.id-dev.dauth.world",
    },
  },
};

export default configs;