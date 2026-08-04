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

/** @typedef {import('./policy-engine.js').Policy} Policy */

/**
 * Policies applicable to a given (wallet, path, index) tuple, partitioned by scope.
 *
 * @typedef {Object} PolicyGroups
 * @property {Policy[]} account - Account-scope policies applicable to the call.
 * @property {Policy[]} project - Project-scope policies applicable to the call.
 */

/**
 * In-memory store for registered policies, partitioned into two buckets:
 *   - `_project`               project-scope policies, ordered list, indexed by id.
 *   - `_accountByWallet`       Map<wallet, ordered list of account-scope policies>
 *                              bound to that wallet identifier (matching against
 *                              `policy.accounts` entries — paths or indexes — is
 *                              done at evaluation time).
 *
 * Same-id-within-same-bucket replaces in place, preserving registration order.
 * Different bindings (same id under wallet A vs wallet B vs project) are
 * independent records.
 *
 * Every stored record carries the condition timeout it was registered with,
 * so the evaluator can race each policy's conditions against its own budget.
 *
 * @internal
 */
export default class PolicyRegistry {
  constructor () {
    /** @private */
    this._project = []

    /** @private */
    this._accountByWallet = new Map()
  }

  /**
   * Registers a single policy under the given wallet bindings.
   * - For a project-scope policy: wallets === undefined applies it globally;
   *   a wallet array narrows the policy to those wallets only.
   * - For an account-scope policy: wallets is required and binds the policy
   *   into the per-wallet account bucket.
   *
   * Stores a defensive deep-ish clone of the policy so callers cannot mutate
   * engine state by editing the original object after registration.
   *
   * @param {Policy} policy - The policy to clone and store.
   * @param {string[] | undefined} wallets - Wallet identifiers the policy binds to. Required for account-scope; undefined for global project-scope.
   * @param {number} conditionTimeoutMs - The effective per-condition timeout, in milliseconds, this policy's conditions are raced against. Already clamped to the engine ceiling by the caller.
   */
  add (policy, wallets, conditionTimeoutMs) {
    const cloned = clonePolicy(policy)

    cloned._conditionTimeoutMs = conditionTimeoutMs

    if (cloned.scope === 'project') {
      // Tag the cloned policy with its wallet restriction for later filtering.
      // undefined means "applies to every wallet".
      cloned._wallets = wallets
      replaceById(this._project, cloned)

      return
    }

    for (const wallet of wallets) {
      if (!this._accountByWallet.has(wallet)) this._accountByWallet.set(wallet, [])

      replaceById(this._accountByWallet.get(wallet), cloned)
    }
  }

  /**
   * Returns the policies that may apply to a given (wallet, path, index) call,
   * partitioned into the two groups (account, project). An account-scope
   * policy matches when `policy.accounts` contains the path (string match)
   * or the index (number match). A project-scope policy matches when it
   * has no wallet restriction or its restriction includes the wallet.
   *
   * @param {string} wallet - The wallet identifier the call targets.
   * @param {string | undefined} path - Derivation path of the account, when known.
   * @param {number | undefined} index - Account index, when known.
   * @returns {PolicyGroups} The applicable policies partitioned by scope.
   */
  applicable (wallet, path, index) {
    const account = []
    const accountPolicies = this._accountByWallet.get(wallet)

    if (accountPolicies) {
      for (const policy of accountPolicies) {
        if (matchesAccount(policy.accounts, path, index)) {
          account.push(policy)
        }
      }
    }

    const project = []

    for (const policy of this._project) {
      if (policy._wallets === undefined || policy._wallets.includes(wallet)) {
        project.push(policy)
      }
    }

    return { account, project }
  }

  /**
   * Returns every policy that's potentially relevant to a given (wallet, path, index),
   * regardless of scope. Used to compute the operation-name set the wrapper
   * needs to handle.
   *
   * @param {string} wallet - The wallet identifier the call targets.
   * @param {string | undefined} path - Derivation path of the account, when known.
   * @param {number | undefined} index - Account index, when known.
   * @returns {Policy[]} All applicable policies flattened across scopes.
   */
  relevant (wallet, path, index) {
    const { account, project } = this.applicable(wallet, path, index)

    return [...account, ...project]
  }

  /**
   * Removes every binding of this wallet from the registry:
   * - account-scope policies bound to the wallet are dropped entirely.
   * - project-scope policies that included this wallet in their restriction
   *   are narrowed to the remaining wallets; if no wallets are left, the
   *   policy is removed entirely.
   * - global (unrestricted) project-scope policies are untouched.
   *
   * @param {string} wallet - The wallet identifier being disposed.
   */
  disposeWallet (wallet) {
    this._accountByWallet.delete(wallet)

    this._project = this._project.filter((policy) => {
      if (policy._wallets === undefined) return true

      const remaining = policy._wallets.filter((w) => w !== wallet)

      if (remaining.length === 0) return false

      policy._wallets = remaining

      return true
    })
  }

  /**
   * Removes every registered policy across both buckets.
   */
  disposeAll () {
    this._project = []
    this._accountByWallet.clear()
  }
}

function matchesAccount (accounts, path, index) {
  if (!Array.isArray(accounts)) return false

  for (const entry of accounts) {
    if (typeof entry === 'string') {
      if (path !== undefined && entry === path) return true
    } else if (typeof entry === 'number') {
      if (index !== undefined && entry === index) return true
    }
  }

  return false
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
    rules: policy.rules.map(cloneRule)
  }
}

function cloneRule (rule) {
  const cloned = {
    ...rule,
    operation: Array.isArray(rule.operation) ? [...rule.operation] : rule.operation,
    conditions: [...rule.conditions]
  }

  // rule.state is reserved; deep clone prevents caller mutation post-registration.
  if (rule.state !== undefined) {
    cloned.state = structuredClone(rule.state)
  }

  return cloned
}
