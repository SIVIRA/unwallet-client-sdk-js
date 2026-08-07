export type Env = "prod" | "dev";

export interface Config {
  env?: Env;
  clientID: string;
}

export interface UnWalletConfig {
  frontend: UnWalletFrontendConfig;
  xAPI: UnWalletXAPIConfig;
}

export interface UnWalletFrontendConfig {
  origin: string;
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
          origin: "https://id.unwallet.world",
        },
        xAPI: {
          url: "wss://xapi.id.unwallet.world",
          connectionTimeout: 10_000,
        },
      };
    case "dev":
      return {
        frontend: {
          origin: "http://localhost:4200",
        },
        xAPI: {
          url: "wss://xapi.id.test.unwallet.dev",
          connectionTimeout: 10_000,
        },
      };
  }
}
