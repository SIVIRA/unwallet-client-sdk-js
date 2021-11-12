import { UnWalletConfig } from "./types";

export const unWalletConfigs: { [env: string]: UnWalletConfig } = {
  prod: {
    baseURL: "https://id.unwallet.world",
    authURL: "https://id.unwallet.world/authorize",
    wsAPIURL: "wss://ws-api.admin.id.dauth.world",
  },
  dev: {
    baseURL: "https://id.unwallet.dev",
    authURL: "https://id.unwallet.dev/authorize",
    wsAPIURL: "wss://ws-api.admin.id-dev.dauth.world",
  },
  local: {
    baseURL: "http://localhost:4200",
    authURL: "http://localhost:4200/authorize",
    wsAPIURL: "wss://ws-api.admin.id-dev.dauth.world",
  },
};
