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

import { PolicyAdapterError } from './policy-error.js'

/** @typedef {import('./operation-record.js').OperationRecord} OperationRecord */

/**
 * A pure function that reads a method's arguments and produces either a
 * partial `OperationRecord` or an array of partial records for methods that
 * describe multiple sub-operations (batched invoice payment, atomic
 * multicall). Returning `null` signals "I recognize the method but have no
 * canonical mapping"; the engine treats that as an uninterpretable call.
 *
 * The registry attaches `raw` after invocation, so extractors omit it.
 * Extractors should not throw for merely malformed input; return a record
 * with `amount: undefined` instead so the policy layer can fail closed with
 * a readable reason. If an extractor does throw, `interpret` wraps it in a
 * `PolicyAdapterError`.
 *
 * @callback Extractor
 * @param {readonly unknown[]} args
 * @returns {Omit<OperationRecord, 'raw'> | Omit<OperationRecord, 'raw'>[] | null}
 */

/**
 * A pack of extractors bound to one or more wallet identifiers. Adapters
 * for the wallets WDK ships are published from `@tetherto/wdk-policies`;
 * consumers ship their own for wallets that aren't covered, or extend a
 * shipped adapter with wallet-specific knowledge.
 *
 * `walletTypes` are the identifiers the consumer passed to `registerWallet`.
 * They are opaque, consumer-chosen names (`'mainnet'`, `'polygon'`,
 * `'treasury'`), not blockchain identifiers, so an adapter must be told
 * which names it serves. Several wallets that share a native asset can
 * share one adapter instance; wallets with different native assets need
 * separate instances.
 *
 * @typedef {Object} Adapter
 * @property {string[]}                     walletTypes - Wallet identifiers this adapter serves. Must match the names used with `registerWallet`.
 * @property {Object.<string, Extractor>}   extractors  - Map of method name to the extractor function for that method.
 */

/**
 * Identifies one intercepted call for `interpret`.
 *
 * @typedef {Object} InterpretRequest
 * @property {string}             walletType - Wallet identifier the call was made against.
 * @property {string}             method     - Method name that was intercepted.
 * @property {readonly unknown[]} args       - Arguments passed to the method.
 * @property {import('./operation-record.js').OperationRaw['account']} [account] - Read-only view of the account, forwarded onto `raw.account` when supplied.
 * @property {string}             [path]     - The account's derivation path, forwarded onto `raw.path` when supplied.
 * @property {number}             [index]    - Account index from `wdk.getAccount(wallet, index)`, forwarded onto `raw.index` when supplied.
 */

/**
 * Runtime registry that stores extractor maps keyed by wallet identifier
 * and interprets intercepted method calls into `OperationRecord`s.
 *
 * `register` replaces the whole extractor map for each of the adapter's
 * wallet identifiers. `extend` merges additional extractors into an existing
 * map. Consumers specializing a shipped adapter register the shipped one
 * first and then extend it.
 */
export default class AdapterRegistry {
  constructor () {
    /**
     * @private
     * @type {Map<string, Object.<string, Extractor>>}
     */
    this._byWalletType = new Map()
  }

  /**
   * Registers an adapter for every wallet identifier it names, replacing any
   * extractor map previously registered under those keys. Each key receives
   * its own shallow copy of `extractors`, so a later `extend` on one key does
   * not leak into siblings.
   *
   * @param {Adapter} adapter - The adapter to register.
   * @returns {this} The registry, for chaining.
   * @throws {Error} If `adapter.walletTypes` is empty or contains a blank key.
   */
  register (adapter) {
    if (adapter.walletTypes.length === 0) {
      throw new Error("The adapter's 'walletTypes' cannot be an empty list.")
    }
    for (const key of adapter.walletTypes) {
      if (!key.trim()) throw new Error("The adapter's 'walletTypes' cannot contain a blank key.")
    }
    for (const key of adapter.walletTypes) {
      this._byWalletType.set(key, { ...adapter.extractors })
    }
    return this
  }

  /**
   * Merges additional extractors into the map already registered for a
   * wallet identifier. Existing method names are overridden; others are kept.
   *
   * @param {string} walletType - The wallet identifier to extend.
   * @param {Object.<string, Extractor>} extractors - Extractors to add or override.
   * @returns {this} The registry, for chaining.
   * @throws {PolicyAdapterError} If no adapter is registered for `walletType`.
   */
  extend (walletType, extractors) {
    const existing = this._byWalletType.get(walletType)
    if (!existing) {
      throw new PolicyAdapterError(`No adapter registered for wallet '${walletType}'; register one before extending it.`, { walletType })
    }
    Object.assign(existing, extractors)
    return this
  }

  /**
   * Runs the registered extractor for the request's wallet identifier and
   * method and returns the resulting record(s) with `raw` attached. Always
   * returns an array (even for single-record extractors) so callers can
   * iterate uniformly.
   *
   * Returns `null` when no adapter is registered for the wallet identifier,
   * when the adapter has no extractor for the method, or when the extractor
   * itself returns `null`. Throws when the extractor throws or returns a
   * record without a string `kind`; engines must treat that as fail-closed.
   *
   * @param {InterpretRequest} request - The intercepted call to interpret.
   * @returns {OperationRecord[] | null} An array of canonical records, or `null` if no interpretation was produced.
   * @throws {PolicyAdapterError} If the extractor throws or produces a malformed record.
   */
  interpret ({ walletType, method, args, account, path, index }) {
    const extractors = this._byWalletType.get(walletType)
    if (!extractors) return null
    const extractor = extractors[method]
    if (typeof extractor !== 'function') return null

    let out
    try {
      out = extractor(args)
    } catch (cause) {
      throw new PolicyAdapterError(`Extractor for ${walletType}.${method} threw.`, { walletType, method, cause })
    }
    if (out === null || out === undefined) return null

    const partials = Array.isArray(out) ? out : [out]
    const raw = { walletType, method, args }
    if (account !== undefined) raw.account = account
    if (path !== undefined) raw.path = path
    if (index !== undefined) raw.index = index
    return partials.map((p, i) => {
      if (!p || typeof p.kind !== 'string' || !p.kind.trim()) {
        throw new PolicyAdapterError(`Extractor for ${walletType}.${method} returned a record without a kind (index ${i}).`, { walletType, method })
      }
      return { ...p, raw }
    })
  }

  /**
   * Returns the wallet identifiers this registry currently has adapters for,
   * so a misconfigured wallet name can be diagnosed against what is
   * actually registered.
   *
   * @returns {string[]} A snapshot of the registered wallet identifiers.
   */
  walletTypes () {
    return Array.from(this._byWalletType.keys())
  }
}
