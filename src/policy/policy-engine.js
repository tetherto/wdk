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

import { createPolicyEnforcedAccount } from './policy-account-proxy.js'
import { PolicyConfigurationError } from './policy-error.js'
import { evaluate } from './policy-evaluator.js'
import PolicyRegistry from './policy-registry.js'
import {
  validateEngineOptions,
  validatePolicy,
  validateRegisterOptions
} from './policy-validators.js'

/** @typedef {import('@tetherto/wdk-wallet').IWalletAccount} IWalletAccount */
/** @typedef {import('@tetherto/wdk-wallet').IWalletAccountReadOnly} IWalletAccountReadOnly */

/**
 * The verdict a matching rule produces: either permit the operation or block it.
 *
 * @typedef {'ALLOW' | 'DENY'} PolicyAction
 */

/**
 * The scope a policy binds to: globally / per-wallet (`project`) or per-account (`account`).
 *
 * @typedef {'project' | 'account'} PolicyScope
 */

/**
 * A wrapped operation name from the supported set, or `*` to match any wrapped operation.
 * Each name must match an actual method on `IWalletAccount` or a registered protocol.
 *
 * @typedef {'sendTransaction' | 'signTransaction' | 'transfer' | 'approve'
 *   | 'sign' | 'signTypedData' | 'signAuthorization' | 'delegate' | 'revokeDelegation'
 *   | 'swap' | 'bridge' | 'supply' | 'withdraw' | 'borrow' | 'repay' | 'buy' | 'sell'
 *   | 'swidge' | 'createDepositAddress' | 'renewDepositAddress'
 *   | 'recoverDepositAddress' | 'disableDepositAddress' | '*'} PolicyOperation
 */

/**
 * The frozen context object passed to every condition function during evaluation.
 *
 * @typedef {Object} PolicyContext
 * @property {PolicyOperation} operation - The intercepted operation name.
 * @property {string} wallet - The wallet identifier (the same string passed to `wdk.registerWallet`). Despite the name, this is an opaque key chosen by the consumer — it might be a chain name like `"ethereum"`, but it could equally be `"treasury-cold"` or any other label.
 * @property {IWalletAccountReadOnly} account - A read-only view of the wallet account.
 * @property {readonly unknown[]} args - The full argument array the wrapped method was called with, snapshotted at evaluation time. `args[0]` is the first argument; every element is readable, so multi-argument operations (e.g. `swidge(options, config)`) can be gated on any of them.
 */

/**
 * A user-supplied predicate that receives the call context and returns
 * (or resolves to) a truthy/falsy verdict. Throwing or timing out is
 * treated per the rule's fail mode (fail-closed for DENY, fail-open-as-no-match for ALLOW).
 *
 * @typedef {(context: PolicyContext) => boolean | Promise<boolean>} PolicyCondition
 */

/**
 * A single ALLOW/DENY decision within a policy, evaluated for one or more
 * operations gated by a list of conditions.
 *
 * @typedef {Object} PolicyRule
 * @property {string} name - Stable identifier for the rule within its policy. Surfaces on PolicyViolationError.ruleName and in simulation traces.
 * @property {string} [reason] - Optional human-readable explanation. When set on a DENY rule that matches, propagates to PolicyViolationError.reason and to the matching simulate-result. Defaults to the rule's name.
 * @property {PolicyOperation | PolicyOperation[]} operation - The wrapped operation(s) this rule addresses. May be a single operation name, an array, or the wildcard `*`.
 * @property {PolicyAction} action - Whether a matching rule allows or denies the operation.
 * @property {boolean} [override_broader_scope] - When true on an account-scope ALLOW rule that matches, the rule's verdict short-circuits project-scope evaluation. Account-scope rules are evaluated in registration order; the first matching override-flag rule wins. Only valid on account-scope ALLOW rules.
 * @property {PolicyCondition[]} conditions - Functions evaluated in order; all must return truthy for the rule to match. Each is raced against the `conditionTimeoutMs` its own policy was registered with.
 * @property {Record<string, unknown>} [state] - Reserved for future use; currently ignored at runtime.
 * @property {(c: PolicyContext) => void | Promise<void>} [onSuccess] - Reserved for future use; currently ignored at runtime.
 */

/**
 * Identifies an account targeted by an account-scope policy: either a derivation
 * path (string, exact match against `account.path`) or a non-negative integer
 * index (matched against the index passed to `wdk.getAccount(wallet, index)`).
 *
 * @typedef {string | number} AccountIdentifier
 */

/**
 * A user-supplied policy: identifies itself, optionally binds to one or more
 * wallets/accounts, and carries an ordered list of rules.
 *
 * @typedef {Object} Policy
 * @property {string} id - Unique identifier within an engine. Re-registering the same id replaces the prior policy in the same wallet bucket.
 * @property {string} name - Human-readable label.
 * @property {PolicyScope} scope - Whether the policy applies to all accounts on the wallet(s) (`project`) or a specific subset (`account`).
 * @property {string | string[]} [wallet] - The wallet identifier(s) this policy binds to. Each entry must match a string previously passed to `wdk.registerWallet`. For `scope: 'project'`, omitting `wallet` applies the policy across every registered wallet; providing one or more narrows it to those wallets. For `scope: 'account'`, `wallet` is required.
 * @property {AccountIdentifier[]} [accounts] - The accounts this policy applies to (required when scope is 'account'). Each entry is either a derivation path (exact-string match against `account.path`) or a non-negative integer (match against the index passed to `wdk.getAccount(wallet, index)`). Index entries do not match accounts retrieved via `getAccountByPath` — use derivation paths if you need both retrieval styles to work.
 * @property {PolicyRule[]} rules - Ordered list of rules. Evaluation is rule-by-rule within a policy; DENY wins over ALLOW within the same scope.
 */

/**
 * Settings supplied to `registerPolicy`, scoped to the policies that call
 * registers. Other policies are unaffected.
 *
 * @typedef {Object} RegisterPolicyOptions
 * @property {Record<string, unknown>} [state] - Reserved for future use; currently ignored at runtime.
 * @property {number} [conditionTimeoutMs] - Per-condition evaluation timeout in milliseconds, applied to every policy this call registers. Defaults to 30000. Values above the engine's `maxConditionTimeoutMs` ceiling are capped to that ceiling. A condition that exceeds the timeout is treated the same as a throw — fail-closed for DENY rules, fail-open-as-no-match for ALLOW rules.
 */

/**
 * Settings supplied to the `PolicyEngine` constructor.
 *
 * @typedef {Object} PolicyEngineOptions
 * @property {number} [maxConditionTimeoutMs] - Upper bound, in milliseconds, on the per-condition timeout any single policy can be given. Defaults to 30000. A policy registered with a larger `conditionTimeoutMs` is capped to this value rather than rejected.
 */

/**
 * One row in a simulation trace: the rule that was evaluated, its scope,
 * and whether all conditions matched.
 *
 * @typedef {Object} SimulationTraceEntry
 * @property {PolicyScope} scope - The scope of the policy that emitted this trace entry.
 * @property {string} policy_id - The id of the policy whose rule was evaluated.
 * @property {string} rule_name - The name of the rule that was evaluated.
 * @property {boolean} matched - True if every condition on the rule returned truthy (and didn't throw or time out).
 * @property {string} [error] - Set when a condition threw or timed out; carries the error message.
 */

/**
 * The structured verdict returned by `account.simulate.<method>(...)`:
 * decision plus the identifying triple plus a per-rule trace.
 *
 * @typedef {Object} SimulationResult
 * @property {'ALLOW' | 'DENY'} decision - The verdict the engine would produce for this context.
 * @property {string | null} policy_id - Id of the policy whose rule produced the verdict, or null when no rule addresses the operation (`no-applicable-rule`) or matched (`governed-but-unmatched`).
 * @property {string | null} matched_rule - Name of the matching rule, or null when no rule matched.
 * @property {string | null} reason - Human-readable explanation: the rule's `reason` field, or one of `matched` / `override` / `no-applicable-rule` / `governed-but-unmatched`.
 * @property {SimulationTraceEntry[]} trace - Per-rule evaluation outcomes in the order they were considered. Useful for debugging.
 */

/**
 * The per-account routing context passed from the WDK manager into the
 * policy engine / proxy wrapper. Identifies which wallet + which
 * account-within-the-wallet a wrapped method is being invoked under,
 * and carries the engine reference the proxy will delegate evaluation to.
 *
 * @typedef {Object} WrapContext
 * @property {string} blockchain - The wallet identifier (the same string passed to `registerWallet`; treated as an opaque key here).
 * @property {string | undefined} path - Derivation path of the account, when known.
 * @property {number | undefined} [index] - Index passed to `wdk.getAccount(wallet, index)`, when known. Used to match index-form entries in `policy.accounts`.
 * @property {PolicyEngine} engine - The PolicyEngine instance the proxy delegates evaluation to.
 */

/**
 * Optional context passed alongside `register()` so the engine can verify
 * wallet bindings against the host application's registry before mutating
 * its own.
 *
 * @typedef {Object} RegistrationContext
 * @property {Set<string>} [knownWallets] - Set of wallet identifiers the host considers registered. When provided, the engine throws if any policy binds to a wallet not in the set.
 */

const DEFAULT_CONDITION_TIMEOUT_MS = 30_000

const DEFAULT_MAX_CONDITION_TIMEOUT_MS = 30_000

/**
 * The orchestration façade. Owns the registry; exposes the two methods the
 * `WDK` class calls (`register`, `applyPoliciesTo`). Internal helpers
 * (`_isGoverned`, `_evaluateContext`, `_simulateContext`) are used by the
 * wrapper module.
 *
 * Each registered policy carries the condition timeout it was registered
 * with; the engine only owns the ceiling that timeout is clamped to.
 *
 * @internal
 */
export default class PolicyEngine {
  /**
   * @param {PolicyEngineOptions} [options] - Engine-level settings such as `maxConditionTimeoutMs`.
   * @throws {PolicyConfigurationError} If `options` is not a plain object or `maxConditionTimeoutMs` is not a finite positive number.
   */
  constructor (options) {
    validateEngineOptions(options)

    /** @private */
    this._registry = new PolicyRegistry()

    /** @private */
    this._maxConditionTimeoutMs = options?.maxConditionTimeoutMs ?? DEFAULT_MAX_CONDITION_TIMEOUT_MS
  }

  /**
   * Registers one or more policies. Synchronously throws on validation failures.
   * Validation runs to completion before any registry mutation, so a failure
   * never leaves the engine partially mutated.
   *
   * @param {Policy | Policy[]} policies - A single policy or array of policies to register.
   * @param {RegisterPolicyOptions} [options] - Settings applied to the policies this call registers, such as `conditionTimeoutMs`.
   * @param {RegistrationContext} [registrationContext] - Optional set of registered wallet identifiers. When provided, the engine verifies every wallet binding referenced by the policies is in the set before touching the registry.
   * @throws {PolicyConfigurationError} If any policy or option fails schema validation, the input is an empty array, or a policy binds to a wallet not present in `registrationContext.knownWallets`.
   */
  register (policies, options, registrationContext) {
    validateRegisterOptions(options)

    const list = Array.isArray(policies) ? policies : [policies]

    if (list.length === 0) {
      throw new PolicyConfigurationError('Policy: must be an object or a non-empty array of objects.')
    }

    const walletsPerPolicy = list.map((policy) => validatePolicy(policy))

    const knownWallets = registrationContext?.knownWallets

    if (knownWallets) {
      for (const wallets of walletsPerPolicy) {
        if (!wallets) continue

        for (const w of wallets) {
          if (!knownWallets.has(w)) {
            throw new PolicyConfigurationError(`registerPolicy: no wallet registered with identifier '${w}'.`)
          }
        }
      }
    }

    const conditionTimeoutMs = Math.min(
      options?.conditionTimeoutMs ?? DEFAULT_CONDITION_TIMEOUT_MS,
      this._maxConditionTimeoutMs
    )

    list.forEach((policy, i) => {
      this._registry.add(policy, walletsPerPolicy[i], conditionTimeoutMs)
    })
  }

  /**
   * Returns a policy-enforced view of the given account — a Proxy that
   * exposes enforced versions of write methods. The original account is
   * never mutated. If no policy applies, returns the original account.
   *
   * @param {IWalletAccount} account - The raw account from the wallet manager. Mutated only by the WDK's `_registerProtocols` step (which runs before this method), not by the policy engine.
   * @param {Omit<WrapContext, 'engine'>} ctx - The per-account routing context. The engine reference is supplied by `this`.
   * @returns {Promise<IWalletAccount>} The enforced proxy, or the original account if no policy applies.
   * @throws {PolicyConfigurationError} If at least one policy applies but the underlying account does not implement `toReadOnlyAccount()`.
   */
  async applyPoliciesTo (account, { blockchain, path, index }) {
    return createPolicyEnforcedAccount(account, { blockchain, path, index, engine: this })
  }

  /**
   * Removes account-scope and wallet-bound project policies registered under
   * the given wallet identifier.
   *
   * @param {string} wallet - The wallet identifier to dispose.
   */
  disposeWallet (wallet) {
    this._registry.disposeWallet(wallet)
  }

  /**
   * Removes all registered policies across every bucket.
   */
  disposeAll () {
    this._registry.disposeAll()
  }

  /** @private */
  _isGoverned (wallet, path, index) {
    const groups = this._registry.applicable(wallet, path, index)

    return groups.account.length > 0 || groups.project.length > 0
  }

  /** @private */
  async _evaluateContext (context, { path, index }) {
    const groups = this._registry.applicable(context.wallet, path, index)

    return evaluate(context, groups)
  }

  /** @private */
  async _simulateContext (context, { path, index }) {
    const verdict = await this._evaluateContext(context, { path, index })

    return {
      decision: verdict.outcome === 'BLOCK' ? 'DENY' : 'ALLOW',
      policy_id: verdict.policyId,
      matched_rule: verdict.ruleName,
      reason: verdict.reason,
      trace: verdict.trace
    }
  }
}
