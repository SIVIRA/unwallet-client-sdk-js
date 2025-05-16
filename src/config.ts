export const VALID_ENVS = ["prod", "dev"] as const;

export const UNWALLET_CONFIG_PROD: UnWalletConfig = {
  frontend: {
    baseURL: "https://id.unwallet.world",
  },
  xapi: {
    url: "wss://xapi.id.unwallet.world",
    connectionTimeout: 10_000,
  },
} as const;

export const UNWALLET_CONFIG_DEV: UnWalletConfig = {
  frontend: {
    baseURL: "http://localhost:4200",
  },
  xapi: {
    url: "wss://xapi.id.test.unwallet.dev",
    connectionTimeout: 10_000,
  },
} as const;

export type Env = (typeof VALID_ENVS)[number];

export interface Config {
  env?: Env;
  clientID: string;
}

export interface UnWalletConfig {
  frontend: UnWalletFrontendConfig;
  xapi: UnWalletXAPIConfig;
}

export interface UnWalletFrontendConfig {
  baseURL: string;
}

export interface UnWalletXAPIConfig {
  url: string;
  connectionTimeout: number; // msec
}

export function getUnWalletConfigByEnv(env: Env): UnWalletConfig {
  switch (env) {
    case "prod":
      return UNWALLET_CONFIG_PROD;
    case "dev":
      return UNWALLET_CONFIG_DEV;
  }
}
