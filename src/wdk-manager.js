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

import { SwapProtocol, BridgeProtocol, LendingProtocol, FiatProtocol } from '@tetherto/wdk-wallet/protocols'

import { PolicyViolationError } from './errors'

const INSTANCE_POLICY_SYMBOL = Symbol('wdk_instance_policies')
const INSTANCE_WRAPPED_SYMBOL = Symbol('wdk_instance_wrapped')

/** @typedef {import('@tetherto/wdk-wallet').IWalletAccount} IWalletAccount */

/** @typedef {import('@tetherto/wdk-wallet').FeeRates} FeeRates */

/** @typedef {import('./wallet-account-with-protocols.js').IWalletAccountWithProtocols} IWalletAccountWithProtocols */

/** @typedef {<A extends IWalletAccount>(account: A) => Promise<void>} MiddlewareFunction */

/**
 * @typedef {Object} PolicyTarget
 * @property {string} [blockchain] - The account blockchain identifier this policy applies to.
 * @property {Object} [protocol] - The protocol this policy applies to.
 * @property {string} [protocol.blockchain] - The blockchain name of the protocol (e.g. "ethereum", "solana").
 * @property {string} [protocol.label] - A protocol label or identifier.
 */

/**
 * @typedef {(method: string, params: any, wallet: any) => boolean|Promise<boolean>} PolicyEvaluator
 */

/**
 * @typedef {Object} Policy
 * @property {string} name - The policy name.
 * @property {PolicyTarget} [target] - Scopes the policy to a specific wallet or protocol.
 * @property {string|string[]} [method] - The method(s) to gate. If omitted, all methods are gated.
 * @property {PolicyEvaluator} evaluate - Evaluates whether the method call is allowed.
 */

export default class WDK {
  /**
   * Creates a new wallet development kit instance.
   *
   * @param {string | Uint8Array} seed - The wallet's BIP-39 seed phrase.
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
    this._protocols = { swap: { }, bridge: { }, lending: { }, fiat: { } }

    /** @private */
    this._middlewares = { }

    /**
     *  @private
     *  @type {Array<Policy>}
     */
    this._policies = []
  }

  /**
   * Returns a random BIP-39 seed phrase.
   *
   * @returns {string} The seed phrase.
   */
  static getRandomSeedPhrase () {
    return WalletManager.getRandomSeedPhrase()
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
   * Register one or more wallet policies.
   *
   * Policies gate all mutating wallet methods.
   *
   * @param {Array<Policy>} policies
   * @returns {WDK}
   */
  registerPolicies (policies = []) {
    if (!Array.isArray(policies)) {
      throw new TypeError('registerPolicies expects an array')
    }

    for (const p of policies) {
      if (!p.name || typeof p.evaluate !== 'function') {
        throw new TypeError('Invalid policy object')
      }
      this._policies.push(p)
    }

    return this
  }

  /**
   * Runs policies sequentially.
   *
   * @param {Array<Policy>} policies
   * @param {string} method
   * @param {any} params
   * @param {PolicyTarget} target
   * @private
   */
  async _runPolicies (policies, method, params, target) {
    for (const policy of policies) {
      const result = await policy.evaluate({ method, params, target })

      if (!result) {
        throw new PolicyViolationError(policy.name, method, target)
      }
    }
  }

  /**
   * Applies policies to a specific account or protocol instance.
   * Policies are isolated per account.
   *
   * @template {typeof SwapProtocol | typeof BridgeProtocol | typeof LendingProtocol | typeof FiatProtocol | IWalletAccountWithProtocols} P
   * @param {P} instance
   * @param {PolicyTarget} target
   * @returns {P}
   * @private
   */
  _withPolicyGate (instance, target) {
    if (!instance[INSTANCE_POLICY_SYMBOL]) {
      Object.defineProperty(instance, INSTANCE_POLICY_SYMBOL, {
        value: new Map(),
        enumerable: false,
        writable: false
      })
    }

    if (!instance[INSTANCE_WRAPPED_SYMBOL]) {
      Object.defineProperty(instance, INSTANCE_WRAPPED_SYMBOL, {
        value: new Set(),
        enumerable: false,
        writable: false
      })
    }

    const methodPolicyMap = instance[INSTANCE_POLICY_SYMBOL]
    const wrappedMethods = instance[INSTANCE_WRAPPED_SYMBOL]

    for (const policy of this._policies) {
      const policyTarget = policy.target || {}
      if (policyTarget.blockchain && policyTarget.blockchain !== target.blockchain) {
        continue
      }

      if (policyTarget.protocol) {
        const policyProtocol = policyTarget.protocol
        const targetProto = target.protocol || {}

        if (policyProtocol.blockchain && policyProtocol.blockchain !== targetProto.blockchain) {
          continue
        }
        if (policyProtocol.label && policyProtocol.label !== targetProto.label) continue
      }

      let methods = policy.method
      if (!methods) {
        methods = new Set()
        let obj = instance
        while (obj && obj !== Object.prototype) {
          Object.getOwnPropertyNames(obj)
            .filter((prop) => typeof obj[prop] === 'function')
            .forEach((prop) => methods.add(prop))

          obj = Object.getPrototypeOf(obj)
        }
      }
      if (typeof methods === 'string') methods = [methods]

      for (const methodName of methods) {
        if (typeof instance[methodName] !== 'function') {
          continue
        }

        if (!methodPolicyMap.has(methodName)) {
          methodPolicyMap.set(methodName, [])
        }

        const list = methodPolicyMap.get(methodName)
        if (!list.includes(policy)) list.push(policy)

        if (!wrappedMethods.has(methodName)) {
          const originalFn = instance[methodName].bind(instance)
          instance[methodName] = async (...args) => {
            const params = args[0]
            const policies = methodPolicyMap.get(methodName) || []
            await this._runPolicies(policies, methodName, params, target)

            return originalFn(...args)
          }

          wrappedMethods.add(methodName)
        }
      }
    }
  }

  /**
   * Registers a new wallet to WDK.
   *
   * @template {typeof WalletManager} W
   * @param {string} blockchain - The name of the blockchain the wallet must be bound to. Can be any string (e.g., "ethereum").
   * @param {W} WalletManager - The wallet manager class.
   * @param {ConstructorParameters<W>[1]} config - The configuration object.
   * @returns {WDK} The wdk instance.
   */
  registerWallet (blockchain, WalletManager, config) {
    const wallet = new WalletManager(this._seed, config)

    this._wallets.set(blockchain, wallet)

    return this
  }

  /**
   * Registers a new protocol to WDK.
   *
   * The label must be unique in the scope of the blockchain and the type of protocol (i.e., there can't be two protocols of the
   * same type bound to the same blockchain with the same label).
   *
   * @see {@link IWalletAccountWithProtocols#registerProtocol} to register protocols only for specific accounts.
   * @template {typeof SwapProtocol | typeof BridgeProtocol | typeof LendingProtocol | typeof FiatProtocol} P
   * @param {string} blockchain - The name of the blockchain the protocol must be bound to. Can be any string (e.g., "ethereum").
   * @param {string} label - The label.
   * @param {P} Protocol - The protocol class.
   * @param {ConstructorParameters<P>[1]} config - The protocol configuration.
   * @returns {WDK} The wdk instance.
   */
  registerProtocol (blockchain, label, Protocol, config) {
    if (Protocol.prototype instanceof SwapProtocol) {
      this._protocols.swap[blockchain] ??= { }

      this._protocols.swap[blockchain][label] = { Protocol, config }
    } else if (Protocol.prototype instanceof BridgeProtocol) {
      this._protocols.bridge[blockchain] ??= { }

      this._protocols.bridge[blockchain][label] = { Protocol, config }
    } else if (Protocol.prototype instanceof LendingProtocol) {
      this._protocols.lending[blockchain] ??= { }

      this._protocols.lending[blockchain][label] = { Protocol, config }
    } else if (Protocol.prototype instanceof FiatProtocol) {
      this._protocols.fiat[blockchain] ??= { }

      this._protocols.fiat[blockchain][label] = { Protocol, config }
    }

    return this
  }

  /**
   * Registers a new middleware to WDK.
   *
   * It's possible to register multiple middlewares for the same blockchain, which will be called sequentially.
   *
   * @param {string} blockchain - The name of the blockchain the middleware must be bound to. Can be any string (e.g., "ethereum").
   * @param {MiddlewareFunction} middleware - A callback function that is called each time the user derives a new account.
   * @returns {WDK} The wdk instance.
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
   * @returns {Promise<IWalletAccountWithProtocols>} The account.
   * @throws {Error} If no wallet has been registered for the given blockchain.
   */
  async getAccount (blockchain, index = 0) {
    if (!this._wallets.has(blockchain)) {
      throw new Error(`No wallet registered for blockchain: ${blockchain}.`)
    }

    const wallet = this._wallets.get(blockchain)

    const account = await wallet.getAccount(index)

    await this._runMiddlewares(account, { blockchain })

    this._registerProtocols(account, { blockchain })

    this._withPolicyGate(account, { blockchain })

    return account
  }

  /**
   * Returns the wallet account for a specific blockchain and BIP-44 derivation path.
   *
   * @param {string} blockchain - The name of the blockchain (e.g., "ethereum").
   * @param {string} path - The derivation path (e.g., "0'/0/0").
   * @returns {Promise<IWalletAccountWithProtocols>} The account.
   * @throws {Error} If no wallet has been registered for the given blockchain.
   */
  async getAccountByPath (blockchain, path) {
    if (!this._wallets.has(blockchain)) {
      throw new Error(`No wallet registered for blockchain: ${blockchain}.`)
    }

    const wallet = this._wallets.get(blockchain)

    const account = await wallet.getAccountByPath(path)

    await this._runMiddlewares(account, { blockchain })

    this._registerProtocols(account, { blockchain })

    this._withPolicyGate(account, { blockchain })

    return account
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
   * Disposes and unregisters all the wallets, erasing any sensitive data from the memory.
   */
  dispose () {
    for (const [, wallet] of this._wallets) {
      wallet.dispose()
    }

    this._wallets.clear()
  }

  /** @private */
  async _runMiddlewares (account, { blockchain }) {
    if (this._middlewares[blockchain]) {
      for (const middleware of this._middlewares[blockchain]) {
        await middleware(account)
      }
    }
  }

  /** @private */
  _registerProtocols (account, { blockchain }) {
    const protocols = { swap: { }, bridge: { }, lending: { }, fiat: { } }

    account.registerProtocol = (label, Protocol, config) => {
      if (Protocol.prototype instanceof SwapProtocol) {
        protocols.swap[label] = new Protocol(account, config)
      } else if (Protocol.prototype instanceof BridgeProtocol) {
        protocols.bridge[label] = new Protocol(account, config)
      } else if (Protocol.prototype instanceof LendingProtocol) {
        protocols.lending[label] = new Protocol(account, config)
      } else if (Protocol.prototype instanceof FiatProtocol) {
        protocols.fiat[label] = new Protocol(account, config)
      }

      return account
    }

    account.getSwapProtocol = (label) => {
      if (this._protocols.swap[blockchain]?.[label]) {
        const { Protocol, config } = this._protocols.swap[blockchain][label]

        const protocol = new Protocol(account, config)
        this._withPolicyGate(protocol, { protocol: { blockchain, label } })
        return protocol
      }

      if (protocols.swap[label]) {
        const protocol = protocols.swap[label]
        this._withPolicyGate(protocol, { protocol: { blockchain, label } })
        return protocol
      }

      throw new Error(`No swap protocol registered for label: ${label}.`)
    }

    account.getBridgeProtocol = (label) => {
      if (this._protocols.bridge[blockchain]?.[label]) {
        const { Protocol, config } = this._protocols.bridge[blockchain][label]

        const protocol = new Protocol(account, config)
        this._withPolicyGate(protocol, { protocol: { blockchain, label } })
        return protocol
      }

      if (protocols.bridge[label]) {
        const protocol = protocols.bridge[label]
        this._withPolicyGate(protocol, { protocol: { blockchain, label } })
        return protocol
      }

      throw new Error(`No bridge protocol registered for label: ${label}.`)
    }

    account.getLendingProtocol = (label) => {
      if (this._protocols.lending[blockchain]?.[label]) {
        const { Protocol, config } = this._protocols.lending[blockchain][label]

        const protocol = new Protocol(account, config)
        this._withPolicyGate(protocol, { protocol: { blockchain, label } })
        return protocol
      }

      if (protocols.lending[label]) {
        const protocol = protocols.lending[label]
        this._withPolicyGate(protocol, { protocol: { blockchain, label } })
        return protocol
      }

      throw new Error(`No lending protocol registered for label: ${label}.`)
    }

    account.getFiatProtocol = (label) => {
      if (this._protocols.fiat[blockchain]?.[label]) {
        const { Protocol, config } = this._protocols.fiat[blockchain][label]

        const protocol = new Protocol(account, config)
        this._withPolicyGate(protocol, { protocol: { blockchain, label } })
        return protocol
      }

      if (protocols.fiat[label]) {
        const protocol = protocols.fiat[label]
        this._withPolicyGate(protocol, { protocol: { blockchain, label } })
        return protocol
      }

      throw new Error(`No fiat protocol registered for label: ${label}.`)
    }
  }
}
