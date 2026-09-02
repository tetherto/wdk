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
 * The identifying triple a DENY verdict carries: which policy, which rule,
 * and the human-readable reason.
 *
 * @typedef {Object} PolicyVerdict
 * @property {string} policyId - The id of the policy that produced the verdict.
 * @property {string} ruleName - The name of the matching rule.
 * @property {string} reason - Human-readable explanation of why the operation was blocked.
 */

/**
 * Error type produced by the policy engine on a DENY verdict.
 */
export default class PolicyViolationError extends Error {
  #policyId
  #ruleName
  #reason

  /**
   * Constructs the error from the identifying triple of the policy verdict.
   *
   * @param {PolicyVerdict} verdict - The verdict triple identifying which policy, which rule, and why.
   */
  constructor ({ policyId, ruleName, reason }) {
    const suffix = reason && reason !== ruleName ? `: ${reason}` : ''

    super(`Policy violation: ${policyId}/${ruleName}${suffix}`)

    this.name = 'PolicyViolationError'
    this.#policyId = policyId
    this.#ruleName = ruleName
    this.#reason = reason
  }

  /**
   * The id of the policy that produced the verdict.
   * @returns {string}
   */
  get policyId () { return this.#policyId }

  /**
   * The name of the rule within the policy that matched.
   * @returns {string}
   */
  get ruleName () { return this.#ruleName }

  /**
   * Human-readable explanation of why the operation was blocked.
   * @returns {string}
   */
  get reason () { return this.#reason }
}

/**
 * Error type produced by the policy engine when it cannot safely operate:
 * invalid registration inputs, a governed wallet that doesn't implement the
 * required read-only interface, or a governed call whose arguments cannot be
 * snapshotted (not structured-cloneable).
 */
export class PolicyConfigurationError extends Error {
  /**
   * Constructs the error with the given configuration-problem explanation.
   *
   * @param {string} message - Human-readable explanation of the configuration problem.
   */
  constructor (message) {
    super(message)

    this.name = 'PolicyConfigurationError'
  }
}

/**
 * Structured context for a `PolicyAdapterError`.
 *
 * @typedef {Object} PolicyAdapterErrorOptions
 * @property {string}  [walletType] - The wallet identifier the failing call was made against.
 * @property {string}  [method]     - The method name that was being interpreted.
 * @property {unknown} [cause]      - The underlying error thrown by the extractor, if any.
 */

/**
 * Error type produced when an adapter fails to produce a usable
 * `OperationRecord`: the extractor threw, or it returned a malformed record
 * (no `kind`). The engine treats this as fail-closed and denies the call. It
 * is deliberately distinct from "no adapter registered" (which `interpret`
 * reports as `null`) so callers can tell configuration gaps from runtime
 * faults.
 */
export class PolicyAdapterError extends Error {
  #walletType
  #method

  /**
   * Constructs the error with a description and optional structured context.
   *
   * @param {string} message - Human-readable description of the failure.
   * @param {PolicyAdapterErrorOptions} [options] - Structured context.
   */
  constructor (message, options = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined)

    this.name = 'PolicyAdapterError'
    this.#walletType = options.walletType
    this.#method = options.method
  }

  /**
   * The wallet identifier the failing call was made against, when known.
   * @returns {string | undefined}
   */
  get walletType () { return this.#walletType }

  /**
   * The method name that was being interpreted, when known.
   * @returns {string | undefined}
   */
  get method () { return this.#method }
}
