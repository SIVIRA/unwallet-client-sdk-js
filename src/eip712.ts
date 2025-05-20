export interface EIP712TypedData {
  types: Record<string, Array<EIP712TypedDataField>>;
  primaryType: string;
  domain: EIP712TypedDataDomain;
  message: Record<string, any>;
}

export interface EIP712TypedDataDomain {
  name?: string;
  version?: string;
  chainId?: number;
  verifyingContract?: string;
  salt?: string;
}

export interface EIP712TypedDataField {
  name: string;
  type: string;
}
