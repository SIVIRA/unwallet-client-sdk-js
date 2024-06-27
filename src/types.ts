export interface Config {
  clientID: string;
  env?: string;
}

export interface UnWalletConfig {
  baseURL: string;
  wsAPIURL: string;
}

export interface SignResult {
  digest: string;
  signature: string;
}

export interface SendTransactionResult {
  TransactionID: string;
}
