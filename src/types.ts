export interface ResponseAddress {
  pubkey: Buffer
  address: string
}

export interface ResponseSign {
  signature: Buffer
}

// transaction is borsh encoded
export type Transaction = Buffer

// all the data is borsh encoded
export interface MerkleProof {
  leavesData: Buffer
  leavesIndices: Buffer
  lemmas: Buffer
  treeSize: Buffer
  rootHash: Buffer
}

// all the data is borsh encoded
export interface Schema {
  merkleProof: MerkleProof
  chainData: Buffer
  rootTypeIndices: Buffer
  extraDataHash: Buffer
  chainHash: Buffer
}
