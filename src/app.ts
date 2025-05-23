/** ******************************************************************************
 *  (c) 2019-2025 Zondax AG
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 ******************************************************************************* */
import type Transport from '@ledgerhq/hw-transport'
import BaseApp, { BIP32Path, INSGeneric, processErrorResponse, processResponse } from '@zondax/ledger-js'
import { ByteStream } from '@zondax/ledger-js/dist/byteStream'

import { P1_VALUES, PUBKEYLEN } from './consts'
import { Schema, Transaction } from './types'
import { ResponseAddress, ResponseSign } from './types'

export class SovereignApp extends BaseApp {
  static _INS = {
    GET_VERSION: 0x00 as number,
    GET_ADDR: 0x01 as number,
    SIGN: 0x02 as number,
    // TODO: Add more INS here
  }

  static _params = {
    cla: 0x64,
    ins: { ...SovereignApp._INS } as INSGeneric,
    p1Values: { ONLY_RETRIEVE: 0x00 as 0, SHOW_ADDRESS_IN_DEVICE: 0x01 as 1 },
    chunkSize: 250,
    requiredPathLengths: [3],
  }

  constructor(transport: Transport) {
    super(transport, SovereignApp._params)
    if (!this.transport) {
      throw new Error('Transport has not been defined')
    }
  }

  async getAddressAndPubKey(path: string, showAddrInDevice = false): Promise<ResponseAddress> {
    const bip44PathBuffer = this.serializePath(path)
    const p1 = showAddrInDevice ? P1_VALUES.SHOW_ADDRESS_IN_DEVICE : P1_VALUES.ONLY_RETRIEVE

    try {
      const responseBuffer = await this.transport.send(this.CLA, this.INS.GET_ADDR, p1, 0, bip44PathBuffer)

      const response = processResponse(responseBuffer)

      return {
        pubkey: response.readBytes(PUBKEYLEN),
        address: response.getAvailableBuffer().toString(),
      } as ResponseAddress
    } catch (e) {
      throw processErrorResponse(e)
    }
  }

  async sign(path: BIP32Path, blob: Transaction, schema: Schema): Promise<ResponseSign> {
    //| borsh(leaves_data) | borsh(indices_leaves) | borsh(lemmas) | borsh(tree_size) | borsh(root_hash) | borsh(root_indexes) | borsh(chain_data) | borsh(extra_metadata_hash) | borsh(transaction) | borsh(chain_hash)
    const chunks = this.prepareChunks(path, this.encodeSchema(blob, schema))
    try {
      let signatureResponse = await this.sendGenericChunk(this.INS.SIGN, 0, 1, chunks.length, chunks[0])

      for (let i = 1; i < chunks.length; i += 1) {
        signatureResponse = await this.sendGenericChunk(this.INS.SIGN, 0, 1 + i, chunks.length, chunks[i])
      }

      return {
        signature: signatureResponse.readBytes(signatureResponse.length()),
      }
    } catch (e) {
      throw processErrorResponse(e)
    }
  }

  encodeSchema(transaction: Transaction, schema: Schema): Buffer {
    const bs = new ByteStream()

    if (!transaction || !schema) {
      throw new Error('Transaction and schema must be provided')
    }

    bs.appendBytes(schema.merkleProof.leavesData)
    bs.appendBytes(schema.merkleProof.leavesIndices)
    bs.appendBytes(schema.merkleProof.lemmas)
    bs.appendBytes(schema.merkleProof.treeSize)
    bs.appendBytes(schema.merkleProof.rootHash)
    bs.appendBytes(schema.rootTypeIndices)
    bs.appendBytes(schema.chainData)
    bs.appendBytes(schema.extraDataHash)
    bs.appendBytes(transaction)
    bs.appendBytes(schema.chainHash)

    return bs.getCompleteBuffer()
  }
}
