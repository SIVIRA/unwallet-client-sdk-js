import { UnWalletConfig } from "./types";

export const unWalletConfigs: { [env: string]: UnWalletConfig } = {
  prod: {
    baseURL: "https://id.unwallet.world",
    authURL: "https://id.unwallet.world/authorize",
    wsAPIURL: "wss://in-ws-api.id.unwallet.world",
  },
  dev: {
    baseURL: "https://id.unwallet.dev",
    authURL: "https://id.unwallet.dev/authorize",
    wsAPIURL: "wss://in-ws-api.id.unwallet.dev",
  },
  local: {
    baseURL: "http://localhost:4200",
    authURL: "http://localhost:4200/authorize",
    wsAPIURL: "wss://in-ws-api.id.test.unwallet.dev",
  },
};
