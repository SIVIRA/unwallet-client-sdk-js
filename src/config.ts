export interface Config {
  clientID: string;
  dAuth: {
    baseURL: string;
    authURL: string;
    wsAPIURL: string;
  };
}
