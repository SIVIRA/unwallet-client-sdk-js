import { VALID_ENVS } from "./consts";

export type Env = (typeof VALID_ENVS)[number];

export interface Config {
  clientID: string;
  env?: Env;
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
}

export interface SignResult {
  digest: string;
  signature: string;
}

export interface SendTransactionResult {
  transactionID: string;
}
