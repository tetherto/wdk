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

/**
 * @internal
 *
 * In-memory store for registered policies, partitioned into three buckets:
 *   - `_project`     project-scope policies, ordered list, indexed by id.
 *   - `_walletByChain[chain]` wallet-scope policies bound to that chain.
 *   - `_accountByChain[chain]` account-scope policies bound to that chain
 *      (matching against `policy.accounts` paths is done at evaluation time).
 *
 * Same-id-within-same-bucket replaces in place, preserving registration order.
 * Different bindings (same id under chain A vs chain B vs project) are
 * independent records.
 */
export default class PolicyRegistry {
  constructor () {
    /** @private */
    this._project = []

    /** @private */
    this._walletByChain = Object.create(null)

    /** @private */
    this._accountByChain = Object.create(null)
  }

  /**
   * Registers a single policy under the given chain bindings.
   * - chains === undefined → project-scope only (policy must be project-scope).
   * - chains is array      → bind under each chain into the matching bucket.
   *
   * Stores a defensive shallow clone of the policy so callers cannot mutate
   * engine state by editing the original object after registration.
   *
   * @param {object} policy
   * @param {string[] | undefined} chains
   */
  add (policy, chains) {
    const cloned = clonePolicy(policy)

    if (cloned.scope === 'project') {
      replaceById(this._project, cloned)

      return
    }

    const target = cloned.scope === 'wallet' ? this._walletByChain : this._accountByChain

    for (const chain of chains) {
      target[chain] ??= []

      replaceById(target[chain], cloned)
    }
  }

  /**
   * Returns the policies that may apply to a given (chain, path) operation,
   * partitioned into the three groups.
   *
   * @param {string} chain
   * @param {string | undefined} path
   * @returns {{ account: object[], wallet: object[], project: object[] }}
   */
  applicable (chain, path) {
    const account = []

    if (path !== undefined && this._accountByChain[chain]) {
      for (const policy of this._accountByChain[chain]) {
        if (policy.accounts && policy.accounts.includes(path)) {
          account.push(policy)
        }
      }
    }

    const wallet = this._walletByChain[chain] ? Array.from(this._walletByChain[chain]) : []
    const project = Array.from(this._project)

    return { account, wallet, project }
  }

  /**
   * Returns every policy that's potentially relevant to a given (chain, path),
   * regardless of scope. Used to compute the operation-name set the wrapper
   * needs to handle.
   *
   * @param {string} chain
   * @param {string | undefined} path
   * @returns {object[]}
   */
  relevant (chain, path) {
    const { account, wallet, project } = this.applicable(chain, path)

    return [...account, ...wallet, ...project]
  }

  /**
   * Removes wallet- and account-scope policies bound to the given chain.
   * Project-scope policies are left untouched.
   *
   * @param {string} chain
   */
  disposeChain (chain) {
    delete this._walletByChain[chain]
    delete this._accountByChain[chain]
  }

  /**
   * Removes every registered policy across all buckets.
   */
  disposeAll () {
    this._project = []

    for (const key of Object.keys(this._walletByChain)) delete this._walletByChain[key]
    for (const key of Object.keys(this._accountByChain)) delete this._accountByChain[key]
  }
}

function replaceById (list, policy) {
  const i = list.findIndex((p) => p.id === policy.id)

  if (i === -1) {
    list.push(policy)
  } else {
    list[i] = policy
  }
}

function clonePolicy (policy) {
  return {
    ...policy,
    accounts: policy.accounts ? [...policy.accounts] : undefined,
    rules: policy.rules.map((rule) => ({
      ...rule,
      operation: Array.isArray(rule.operation) ? [...rule.operation] : rule.operation,
      conditions: [...rule.conditions]
    }))
  }
}
