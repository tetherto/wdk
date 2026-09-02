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

import { DEFAULT_CONDITION_TIMEOUT_MS } from './constants.js'
import { buildContext } from './policy-context.js'
import { evaluate } from './policy-evaluator.js'
import PolicyRegistry from './policy-registry.js'
import { ruleAddressesOperation, validatePolicy, validateRegisterOptions } from './policy-validators.js'
import TransactionPolicy from './transaction-policy.js'

/** @typedef {import('./policy-engine.js').Policy} Policy */
/** @typedef {import('./policy-engine.js').PolicyScope} PolicyScope */
/** @typedef {import('./policy-engine.js').RegisterPolicyOptions} RegisterPolicyOptions */
/** @typedef {import('./operation-record.js').OperationRecord} OperationRecord */
/** @typedef {import('./transaction-policy.js').TransactionPolicyVerdict} TransactionPolicyVerdict */

/**
 * A rule-shaped policy definition (the object accepted by `registerPolicy`)
 * implemented as a `TransactionPolicy`.
 *
 * This is the adapter that lets rule-shaped and code-defined policies
 * compose under one contract. It reuses the engine's own validation,
 * registry, context building and evaluator, so within a single policy the
 * semantics are exactly those of today's engine: rules are consulted in
 * order, DENY wins, a throwing or timed-out condition fails closed on DENY
 * rules and open-as-no-match on ALLOW rules, an account-scope ALLOW rule
 * with `override_broader_scope` reports `reason: 'override'`, and condition
 * functions receive the same frozen, snapshotted `PolicyContext`.
 *
 * Verdict mapping from the evaluator's outcome:
 *
 * - `ALLOW` → `{ outcome: 'allow' }` (with `reason: 'override'` when an
 *   override rule short-circuited).
 * - `BLOCK` from a matching DENY rule → `{ outcome: 'deny', reason }`.
 * - `BLOCK` because the policy's rules address the operation but none of
 *   their conditions held → `{ outcome: 'abstain' }`. Within one policy that
 *   is "no opinion"; the engine's cross-policy default-deny then applies,
 *   which is the same final decision today's engine produces.
 *
 * `match` honours the definition's wallet and account bindings as well as
 * its rules' `operation` fields, so an instance is safe to consult even when
 * the caller has not pre-filtered by scope. Cross-policy composition
 * (DENY-wins across policies, account-scope override of project-scope
 * DENYs) is the engine's responsibility, not this class's.
 *
 * `commit` and `rollback` are no-ops: rule-shaped policies are stateless.
 * The `state` and `onSuccess` rule fields remain reserved.
 */
export default class RulePolicy extends TransactionPolicy {
  #id
  #name
  #scope
  #registry

  /**
   * Validates the definition and options exactly as `registerPolicy` does,
   * then stores a defensive clone tagged with the condition timeout.
   *
   * @param {Policy} definition - The rule-shaped policy definition.
   * @param {RegisterPolicyOptions} [options] - Settings such as `conditionTimeoutMs`. The engine clamps this to its `maxConditionTimeoutMs` ceiling before constructing an instance; standalone callers get the value as given.
   * @throws {PolicyConfigurationError} If the definition or options fail schema validation.
   */
  constructor (definition, options) {
    super()

    validateRegisterOptions(options)

    const wallets = validatePolicy(definition)

    this.#id = definition.id
    this.#name = definition.name
    this.#scope = definition.scope
    this.#registry = new PolicyRegistry()
    this.#registry.add(definition, wallets, options?.conditionTimeoutMs ?? DEFAULT_CONDITION_TIMEOUT_MS)
  }

  /**
   * The definition's `id`.
   * @returns {string}
   */
  get id () { return this.#id }

  /**
   * The definition's human-readable `name`.
   * @returns {string}
   */
  get name () { return this.#name }

  /**
   * The definition's scope.
   * @returns {PolicyScope}
   */
  get scope () { return this.#scope }

  /**
   * Resolves `true` when the definition binds to the call's wallet (and,
   * for account scope, its path or index) and at least one rule addresses
   * the call's method.
   *
   * @override
   * @param {OperationRecord} op - The intercepted operation.
   * @returns {Promise<boolean>}
   */
  async match (op) {
    const { account, project } = this.#groups(op)
    const applicable = account.length > 0 ? account : project

    if (applicable.length === 0) return false

    return applicable[0].rules.some((rule) => ruleAddressesOperation(rule, op.raw.method))
  }

  /**
   * Runs the definition's rules through the engine's evaluator against a
   * `PolicyContext` built from the record and maps the outcome; see the
   * class description for the mapping.
   *
   * @override
   * @param {OperationRecord} op - The intercepted operation.
   * @returns {Promise<TransactionPolicyVerdict>}
   * @throws {PolicyConfigurationError} If any argument on the record is not structured-cloneable.
   */
  async evaluate (op) {
    const context = buildContext({
      operation: op.raw.method,
      wallet: op.raw.walletType,
      account: /** @type {any} */ (op.raw.account),
      args: op.raw.args
    })

    const verdict = await evaluate(context, this.#groups(op))

    if (verdict.outcome === 'ALLOW') {
      return verdict.reason === 'override' ? { outcome: 'allow', reason: 'override' } : { outcome: 'allow' }
    }

    if (verdict.reason === 'governed-but-unmatched' || verdict.reason === 'no-applicable-rule') {
      return { outcome: 'abstain', reason: `${this.#id}: no rule matched ${op.raw.method}` }
    }

    return { outcome: 'deny', reason: /** @type {string} */ (verdict.reason) }
  }

  #groups (op) {
    return this.#registry.applicable(op.raw.walletType, op.raw.path, op.raw.index)
  }
}
