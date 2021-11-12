export interface Config {
  clientID: string;
  env?: string;
}

export interface UnWalletConfig {
  baseURL: string;
  authURL: string;
  wsAPIURL: string;
}

export interface MetaTransaction {
  executor: string;
  data: string;
  signature: string;
}
