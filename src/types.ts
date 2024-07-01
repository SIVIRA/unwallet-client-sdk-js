export interface Config {
  clientID: string;
  env?: string;
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
