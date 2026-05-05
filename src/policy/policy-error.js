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
 * Thrown by a wrapped wallet account method when a registered policy blocks
 * the attempted operation. Carries the policy id, rule name, and a
 * human-readable reason so callers (developers, agent runtimes) can react.
 */
export default class PolicyViolationError extends Error {
  /**
   * @param {string} policyId - The id of the policy that produced the verdict.
   * @param {string} ruleName - The name of the matching rule.
   * @param {string} reason - A human-readable explanation.
   */
  constructor (policyId, ruleName, reason) {
    const suffix = reason && reason !== ruleName ? `: ${reason}` : ''

    super(`Policy violation: ${policyId}/${ruleName}${suffix}`)

    this.name = 'PolicyViolationError'

    /** @type {string} */
    this.policyId = policyId

    /** @type {string} */
    this.ruleName = ruleName

    /** @type {string} */
    this.reason = reason
  }
}

/**
 * Thrown synchronously by registerPolicy() and the underlying validators when
 * a policy or registration call is malformed (unknown operation, missing
 * required field, contradictory configuration, etc.). Distinct from
 * PolicyViolationError, which fires at runtime when a registered policy
 * blocks a transaction.
 */
export class PolicyConfigurationError extends Error {
  /**
   * @param {string} message - Human-readable explanation of the configuration problem.
   */
  constructor (message) {
    super(message)

    this.name = 'PolicyConfigurationError'
  }
}
