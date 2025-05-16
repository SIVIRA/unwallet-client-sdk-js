export interface EIP712TypedDataDomain {
  name?: string | null;
  version?: string | null;
  chainId?: number | null;
  verifyingContract?: string | null;
  salt?: string | Uint8Array | null;
}

export interface EIP712TypedDataField {
  name: string;
  type: string;
}
