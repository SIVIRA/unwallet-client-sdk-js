export interface Config {
  clientID: string;
  env?: string;
}

export interface UnWalletConfig {
  baseURL: string;
  wsAPIURL: string;
}

export interface DigestAndSignature {
  digest: string;
  signature: string;
}

export interface MetaTransaction {
  executor: string;
  data: string;
  signature: string;
}
