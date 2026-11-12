// Copyright 2024 Tether Operations Limited
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict'

import WalletManager, { IWalletAccount } from '@tetherto/wdk-wallet'

/**
 * A wallet account that derives nothing and talks to no network. It exists so the
 * example can exercise the orchestrator, the middleware hook and the policy engine
 * without pulling a chain-specific package into the bundle.
 *
 * The methods below are the surface the WDK needs from any account: an address, at
 * least one write-facing operation to govern, a read-only view for policy conditions,
 * a derivation path, and disposal.
 */
export class DemoAccount extends IWalletAccount {
  /**
   * @param {string} address - The address the account reports.
   * @param {string} path - The derivation path the account was retrieved at.
   */
  constructor (address, path) {
    super()

    /** @private */
    this._address = address

    /** @private */
    this._path = path
  }

  /** @returns {string} The derivation path. */
  get path () {
    return this._path
  }

  /** @returns {Promise<string>} The address. */
  async getAddress () {
    return this._address
  }

  /**
   * A stand-in write operation. Real packages sign and broadcast here; the policy
   * engine governs this method either way.
   *
   * @param {{ value: bigint }} transaction - The transaction to send.
   * @returns {Promise<string>} A fake transaction id.
   */
  async sendTransaction (transaction) {
    return `demo-tx:${transaction.value}`
  }

  /**
   * The read-only view handed to policy conditions. The policy engine refuses to
   * govern an account that cannot produce one.
   *
   * @returns {Promise<{ getAddress: () => Promise<string> }>} The read-only view.
   */
  async toReadOnlyAccount () {
    return { getAddress: async () => this._address }
  }

  /** Disposes the account. */
  dispose () {}
}

/**
 * A wallet manager with no chain behind it. Registering it with a WDK is enough to
 * drive account retrieval, fee rates, middleware and policies.
 */
export default class DemoWalletManager extends WalletManager {
  /**
   * @param {number} index - The account index.
   * @returns {Promise<DemoAccount>} The account.
   */
  async getAccount (index) {
    return new DemoAccount(`demo-address-${index}`, `0'/0/${index}`)
  }

  /**
   * @param {string} path - The derivation path.
   * @returns {Promise<DemoAccount>} The account.
   */
  async getAccountByPath (path) {
    return new DemoAccount(`demo-address-at-${path}`, path)
  }

  /** @returns {Promise<{ normal: bigint, fast: bigint }>} The fee rates. */
  async getFeeRates () {
    return { normal: 1n, fast: 2n }
  }

  /** Disposes the wallet manager. */
  dispose () {}
}
