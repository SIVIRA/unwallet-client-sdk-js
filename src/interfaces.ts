export interface Config {
  clientID: string;
  dAuth: {
    baseURL: string;
    authURL: string;
    wsAPIURL: string;
  };
}

export interface MetaTransaction {
  executor: string;
  data: string;
  signature: string;
}
