import { UnWalletConfig } from "./types";

export const VALID_ENVS = ["prod", "dev"] as const;

export const VALID_AUTHORIZATION_RESPONSE_MODES = [
  "fragment",
  "form_post",
] as const;

export const UNWALLET_CONFIG_PROD: UnWalletConfig = {
  frontend: {
    baseURL: "https://id.unwallet.world",
  },
  xapi: {
    url: "wss://xapi.id.unwallet.world",
  },
} as const;

export const UNWALLET_CONFIG_DEV: UnWalletConfig = {
  frontend: {
    baseURL: "http://localhost:4200",
  },
  xapi: {
    url: "wss://xapi.id.test.unwallet.dev",
  },
} as const;
