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

import WalletManager from '@tetherto/wdk-wallet'

import { SwapProtocol, BridgeProtocol, LendingProtocol, FiatProtocol, SwidgeProtocol, SdaProtocol } from '@tetherto/wdk-wallet/protocols'

/** @typedef {import('@tetherto/wdk-wallet').IWalletAccount} IWalletAccount */

/** @typedef {import('@tetherto/wdk-wallet').FeeRates} FeeRates */

/** @typedef {import('./wallet-account-with-protocols.js').IWalletAccountWithProtocols} IWalletAccountWithProtocols */

/**
 * @template {any[]} A
 * @typedef {import('./wallet-account-with-protocols.js').ProtocolConstructor<A>} ProtocolConstructor
 */

/**
 * The shape returned by `getAccount` / `getAccountByPath`: the underlying
 * IWalletAccount (sendTransaction, signTransaction, transfer, approve,
 * sign, …) plus the protocol-getter surface added by the WDK at account
 * retrieval time. Concrete wallet packages may further extend this shape.
 *
 * @typedef {IWalletAccount & IWalletAccountWithProtocols} WdkAccount
 */

/**
 * Where an account came from, passed to every middleware alongside the account.
 *
 * @typedef {Object} MiddlewareContext
 * @property {string} blockchain - The wallet identifier the account was retrieved from, as passed to `registerWallet`.
 * @property {number} [index] - The account index, when the account was retrieved with `getAccount`.
 * @property {string} path - The account's full derivation path.
 */

/**
 * A function called each time an account is retrieved. It may return a replacement account (for example a wrapper that
 * governs the account's methods), which subsequent middlewares and the caller then receive; returning nothing keeps the
 * account as it is.
 *
 * @typedef {<A extends IWalletAccount>(account: A, context: MiddlewareContext) => Promise<A | void>} MiddlewareFunction
 */

export default class WDK {
  /**
   * Creates a new WDK.
   *
   * @param {string | Uint8Array} seed - A BIP-39 mnemonic seed phrase, or a raw BIP-32 master seed (16-64 bytes).
   * @throws {Error} If the seed is not valid.
   */
  constructor (seed) {
    if (!WDK.isValidSeed(seed)) {
      throw new Error('Invalid seed.')
    }

    /** @private */
    this._seed = seed

    /** @private */
    this._wallets = new Map()

    /** @private */
    this._protocols = { swap: Object.create(null), bridge: Object.create(null), lending: Object.create(null), fiat: Object.create(null), swidge: Object.create(null), sda: Object.create(null) }

    /** @private */
    this._middlewares = Object.create(null)

    /** @private */
    this._decoratedAccounts = new WeakSet()

    /** @private */
    this._accountPaths = new WeakMap()
  }

  /**
   * Returns a random BIP-39 seed phrase.
   *
   * @param {12 | 24} [wordCount] - The number of words to include in the seed phrase (default: 12).
   * @returns {string} The seed phrase.
   */
  static getRandomSeedPhrase (wordCount = 12) {
    return WalletManager.getRandomSeedPhrase(wordCount)
  }

  /**
   * Checks if a seed is valid.
   *
   * @param {string | Uint8Array} seed - The seed.
   * @returns {boolean} True if the seed is valid.
   */
  static isValidSeed (seed) {
    if (seed instanceof Uint8Array) {
      return seed.length >= 16 && seed.length <= 64
    }

    return WalletManager.isValidSeedPhrase(seed)
  }

  /**
   * Registers a new wallet to the WDK.
   *
   * @template {typeof WalletManager} W
   * @param {string} blockchain - The name of the blockchain the wallet must be bound to. Can be any string (e.g., "ethereum").
   * @param {W} WalletManager - The wallet manager class.
   * @param {ConstructorParameters<W>[1]} config - The configuration object.
   * @returns {WDK} The WDK.
   * @throws {Error} If a wallet is already registered for the given blockchain.
   */
  registerWallet (blockchain, WalletManager, config) {
    if (this._wallets.has(blockchain)) {
      throw new Error(`A wallet is already registered for blockchain: ${blockchain}. Call dispose([${JSON.stringify(blockchain)}]) before re-registering.`)
    }

    const wallet = new WalletManager(this._seed, config)

    this._wallets.set(blockchain, wallet)

    return this
  }

  /**
   * Registers a new protocol to the WDK.
   *
   * The label must be unique in the scope of the blockchain and the type of protocol (i.e., there can't be two protocols of the
   * same type bound to the same blockchain with the same label).
   *
   * @see {@link IWalletAccountWithProtocols#registerProtocol} to register protocols only for specific accounts.
   * @template {any[]} A
   * @param {string} blockchain - The name of the blockchain the protocol must be bound to. Can be any string (e.g., "ethereum").
   * @param {string} label - The label.
   * @param {ProtocolConstructor<A>} Protocol - The protocol class.
   * @param {NoInfer<A>} config - The protocol configuration.
   * @returns {WDK} The WDK.
   */
  registerProtocol (blockchain, label, Protocol, ...config) {
    if (Protocol.prototype instanceof SwidgeProtocol) {
      this._protocols.swidge[blockchain] ??= Object.create(null)

      this._protocols.swidge[blockchain][label] = { Protocol, config }
    } else if (Protocol.prototype instanceof SdaProtocol) {
      this._protocols.sda[blockchain] ??= Object.create(null)

      this._protocols.sda[blockchain][label] = { Protocol, config }
    } else if (Protocol.prototype instanceof SwapProtocol) {
      this._protocols.swap[blockchain] ??= Object.create(null)

      this._protocols.swap[blockchain][label] = { Protocol, config }
    } else if (Protocol.prototype instanceof BridgeProtocol) {
      this._protocols.bridge[blockchain] ??= Object.create(null)

      this._protocols.bridge[blockchain][label] = { Protocol, config }
    } else if (Protocol.prototype instanceof LendingProtocol) {
      this._protocols.lending[blockchain] ??= Object.create(null)

      this._protocols.lending[blockchain][label] = { Protocol, config }
    } else if (Protocol.prototype instanceof FiatProtocol) {
      this._protocols.fiat[blockchain] ??= Object.create(null)

      this._protocols.fiat[blockchain][label] = { Protocol, config }
    }

    return this
  }

  /**
   * Registers a new middleware to the WDK.
   *
   * It's possible to register multiple middlewares for the same blockchain, which will be called sequentially, after
   * the account's protocol getters are attached. A middleware may return a replacement account: the next middleware,
   * and finally the caller of `getAccount` or `getAccountByPath`, receive the replacement instead of the original.
   *
   * @param {string} blockchain - The name of the blockchain the middleware must be bound to. Can be any string (e.g., "ethereum").
   * @param {MiddlewareFunction} middleware - A callback function that is called each time the user derives a new account.
   * @returns {WDK} The WDK.
   */
  registerMiddleware (blockchain, middleware) {
    this._middlewares[blockchain] ??= []

    this._middlewares[blockchain].push(middleware)

    return this
  }

  /**
   * Returns the wallet account for a specific blockchain and index (see BIP-44).
   *
   * @param {string} blockchain - The name of the blockchain (e.g., "ethereum").
   * @param {number} [index] - The index of the account to get (default: 0).
   * @returns {Promise<WdkAccount>} The account, or the replacement the last middleware that returned one produced.
   * @throws {Error} If no wallet has been registered for the given blockchain.
   */
  async getAccount (blockchain, index = 0) {
    if (!this._wallets.has(blockchain)) {
      throw new Error(`No wallet registered for blockchain: ${blockchain}.`)
    }

    const wallet = this._wallets.get(blockchain)

    const account = await wallet.getAccount(index)

    this._registerProtocols(account, { blockchain })

    return await this._runMiddlewares(account, { blockchain, index, path: this._getAccountPath(account) })
  }

  /**
   * Returns the wallet account for a specific blockchain and BIP-44 derivation path.
   *
   * @param {string} blockchain - The name of the blockchain (e.g., "ethereum").
   * @param {string} path - The derivation path (e.g., "0'/0/0").
   * @returns {Promise<WdkAccount>} The account, or the replacement the last middleware that returned one produced.
   * @throws {Error} If no wallet has been registered for the given blockchain.
   */
  async getAccountByPath (blockchain, path) {
    if (!this._wallets.has(blockchain)) {
      throw new Error(`No wallet registered for blockchain: ${blockchain}.`)
    }

    const wallet = this._wallets.get(blockchain)

    const account = await wallet.getAccountByPath(path)

    this._registerProtocols(account, { blockchain })

    return await this._runMiddlewares(account, { blockchain, path: this._getAccountPath(account) })
  }

  /**
   * Returns the current fee rates for a specific blockchain.
   *
   * @param {string} blockchain - The name of the blockchain (e.g., "ethereum").
   * @returns {Promise<FeeRates>} The fee rates (in base unit).
   * @throws {Error} If no wallet has been registered for the given blockchain.
   */
  async getFeeRates (blockchain) {
    if (!this._wallets.has(blockchain)) {
      throw new Error(`No wallet registered for blockchain: ${blockchain}.`)
    }

    const wallet = this._wallets.get(blockchain)

    const feeRates = await wallet.getFeeRates()

    return feeRates
  }

  /**
   * Disposes and unregisters wallets, erasing any sensitive data from memory.
   * If no blockchains are specified, all registered wallets are disposed.
   * @param {string[]} [blockchains] - The blockchains to dispose. If omitted, all wallets are disposed.
   */
  dispose (blockchains) {
    for (const [blockchain, wallet] of this._wallets) {
      if (!blockchains || blockchains.includes(blockchain)) {
        wallet.dispose()
        this._wallets.delete(blockchain)
      }
    }
  }

  /** @private */
  _getAccountPath (account) {
    let path = this._accountPaths.get(account)

    if (path === undefined) {
      path = account.path
      this._accountPaths.set(account, path)
    }

    return path
  }

  /** @private */
  async _runMiddlewares (account, context) {
    let current = account

    for (const middleware of this._middlewares[context.blockchain] ?? []) {
      current = (await middleware(current, context)) ?? current
    }

    return current
  }

  /** @private */
  _registerProtocols (account, { blockchain }) {
    if (this._decoratedAccounts.has(account)) return

    this._decoratedAccounts.add(account)

    const registered = { swap: Object.create(null), bridge: Object.create(null), lending: Object.create(null), fiat: Object.create(null), swidge: Object.create(null), sda: Object.create(null) }

    const categoryOf = (Protocol) => {
      if (Protocol.prototype instanceof SwidgeProtocol) return 'swidge'
      if (Protocol.prototype instanceof SdaProtocol) return 'sda'
      if (Protocol.prototype instanceof SwapProtocol) return 'swap'
      if (Protocol.prototype instanceof BridgeProtocol) return 'bridge'
      if (Protocol.prototype instanceof LendingProtocol) return 'lending'
      if (Protocol.prototype instanceof FiatProtocol) return 'fiat'

      return null
    }

    account.registerProtocol = (label, Protocol, ...config) => {
      const category = categoryOf(Protocol)

      if (category) registered[category][label] = { Protocol, config }

      return account
    }

    account._buildProtocol = (category, label, subject = account) => {
      const global = this._protocols[category][blockchain]?.[label]

      if (global) return new global.Protocol(account, ...global.config)

      if (registered[category][label]) {
        const { Protocol, config } = registered[category][label]

        return new Protocol(subject, ...config)
      }

      throw new Error(`No ${category} protocol registered for label: ${label}.`)
    }

    account.getSwapProtocol = (label) => account._buildProtocol('swap', label)
    account.getBridgeProtocol = (label) => account._buildProtocol('bridge', label)
    account.getLendingProtocol = (label) => account._buildProtocol('lending', label)
    account.getFiatProtocol = (label) => account._buildProtocol('fiat', label)
    account.getSwidgeProtocol = (label) => account._buildProtocol('swidge', label)
    account.getSdaProtocol = (label) => account._buildProtocol('sda', label)
  }
}
