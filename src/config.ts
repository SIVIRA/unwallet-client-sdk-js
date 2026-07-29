export type Env = "prod" | "dev";

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
      return {
        frontend: {
          baseURL: "https://id.unwallet.world",
        },
        xapi: {
          url: "wss://xapi.id.unwallet.world",
          connectionTimeout: 10_000,
        },
      };
    case "dev":
      return {
        frontend: {
          baseURL: "http://localhost:4200",
        },
        xapi: {
          url: "wss://xapi.id.test.unwallet.dev",
          connectionTimeout: 10_000,
        },
      };
  }
}
