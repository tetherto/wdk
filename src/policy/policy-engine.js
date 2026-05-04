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

import { applyPoliciesToAccount } from './policy-account-wrapper.js'
import { PolicyConfigurationError } from './policy-error.js'
import { evaluate } from './policy-evaluator.js'
import PolicyRegistry from './policy-registry.js'
import {
  collectReferencedOperations,
  normaliseChainArg,
  validatePolicy,
  validateRegisterOptions
} from './policy-validators.js'

/** @typedef {import('@tetherto/wdk-wallet').IWalletAccountReadOnly} IWalletAccountReadOnly */

/**
 * @typedef {'ALLOW' | 'DENY'} PolicyAction
 */

/**
 * @typedef {'project' | 'wallet' | 'account'} PolicyScope
 */

/**
 * @typedef {'sendTransaction' | 'transfer' | 'approve' | 'signMessage' | 'signHash'
 *   | 'signTypedData' | 'signAuthorization' | 'delegate' | 'revokeDelegation'
 *   | 'swap' | 'bridge' | 'supply' | 'withdraw' | 'borrow' | 'repay' | 'buy' | 'sell'
 *   | '*'} PolicyOperation
 */

/**
 * @typedef {object} PolicyContext
 * @property {PolicyOperation} operation - The intercepted operation name.
 * @property {string} chain - The blockchain identifier.
 * @property {IWalletAccountReadOnly} account - A read-only view of the wallet account.
 * @property {unknown} params - The first argument to the wrapped method.
 * @property {readonly unknown[]} args - The full argument array.
 */

/**
 * @typedef {(context: PolicyContext) => boolean | Promise<boolean>} PolicyCondition
 */

/**
 * @typedef {object} PolicyRule
 * @property {string} name
 * @property {PolicyOperation | PolicyOperation[]} operation
 * @property {PolicyAction} action
 * @property {boolean} [override_broader_scope]
 * @property {PolicyCondition[]} conditions
 * @property {object} [state]                                       Reserved for Phase 2; ignored at runtime.
 * @property {(c: PolicyContext) => void | Promise<void>} [onSuccess]   Reserved for Phase 2; ignored at runtime.
 */

/**
 * @typedef {object} Policy
 * @property {string} id
 * @property {string} name
 * @property {PolicyScope} scope
 * @property {string[]} [accounts] - Required when scope is 'account'.
 * @property {PolicyRule[]} rules
 */

/**
 * @typedef {object} RegisterPolicyOptions
 * @property {object} [state] - Reserved for Phase 2.
 */

/**
 * @typedef {object} SimulationTraceEntry
 * @property {PolicyScope} scope
 * @property {string} policyId
 * @property {string} ruleName
 * @property {boolean} matched
 * @property {string} [error]
 */

/**
 * @typedef {object} SimulationResult
 * @property {'ALLOW' | 'DENY'} decision
 * @property {string | null} policy_id
 * @property {string | null} matched_rule
 * @property {string | null} reason
 * @property {SimulationTraceEntry[]} trace
 */

/**
 * @internal
 *
 * The orchestration façade. Owns the registry; exposes the two methods the
 * `WDK` class calls (`register`, `applyPoliciesTo`). Internal helpers
 * (`_relevantOperations`, `_evaluateContext`, `_simulateContext`) are used
 * by the wrapper module.
 */
export default class PolicyEngine {
  constructor () {
    /** @private */
    this._registry = new PolicyRegistry()
  }

  /**
   * Registers one or more policies. Synchronously throws on validation failures.
   *
   * @param {string | string[] | undefined} chain
   * @param {Policy | Policy[]} policies
   * @param {RegisterPolicyOptions} [options]
   */
  register (chain, policies, options) {
    const chains = normaliseChainArg(chain)

    validateRegisterOptions(options)

    const list = Array.isArray(policies) ? policies : [policies]

    if (list.length === 0) {
      throw new PolicyConfigurationError('Policy: must be an object or a non-empty array of objects.')
    }

    for (const policy of list) {
      validatePolicy(policy, chains)
    }

    for (const policy of list) {
      this._registry.add(policy, chains)
    }
  }

  /**
   * Wraps the given account with policy enforcement.
   *
   * @param {object} account
   * @param {object} ctx
   * @param {string} ctx.blockchain
   * @param {string | undefined} ctx.path
   */
  async applyPoliciesTo (account, { blockchain, path }) {
    await applyPoliciesToAccount(account, { blockchain, path, engine: this })
  }

  /**
   * Removes wallet- and account-bound policies for the given chain.
   *
   * @param {string} chain
   */
  disposeChain (chain) {
    this._registry.disposeChain(chain)
  }

  /**
   * Removes all registered policies across every bucket.
   */
  disposeAll () {
    this._registry.disposeAll()
  }

  /** @private */
  _relevantOperations (chain, path) {
    return collectReferencedOperations(this._registry.relevant(chain, path))
  }

  /** @private */
  async _evaluateContext (context, { path }) {
    const groups = this._registry.applicable(context.chain, path)

    return evaluate(context, groups)
  }

  /** @private */
  async _simulateContext (context, { path }) {
    const verdict = await this._evaluateContext(context, { path })

    return {
      decision: verdict.outcome === 'BLOCK' ? 'DENY' : 'ALLOW',
      policy_id: verdict.policyId,
      matched_rule: verdict.ruleName,
      reason: verdict.reason,
      trace: verdict.trace
    }
  }
}
