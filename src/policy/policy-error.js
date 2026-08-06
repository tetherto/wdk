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

import { DENIAL_CODES } from './constants.js'

/**
 * Machine-readable discriminator for why the engine blocked an operation.
 * `RULE_DENIED` means a DENY rule matched. The other two are the default-deny
 * paths: `NO_APPLICABLE_RULE` when no registered rule addresses the operation
 * at all, `GOVERNED_BUT_UNMATCHED` when rules address it but no condition set
 * matched.
 *
 * @typedef {'RULE_DENIED' | 'NO_APPLICABLE_RULE' | 'GOVERNED_BUT_UNMATCHED'} DenialCode
 */

/**
 * The identifying set a DENY verdict carries: which policy, which rule, the
 * human-readable reason, and the machine-readable denial code.
 *
 * @typedef {Object} PolicyVerdict
 * @property {string} policyId - The id of the policy that produced the verdict.
 * @property {string} ruleName - The name of the matching rule.
 * @property {string} reason - Human-readable explanation of why the operation was blocked.
 * @property {DenialCode} code - Which denial path produced the verdict.
 */

const CATCH_ALL_SNIPPET = `wdk.registerPolicy({
  rules: [{ operation: '*', action: 'ALLOW', conditions: [] }]
})`

const DEFAULT_DENY_DIAGNOSIS = {
  [DENIAL_CODES.NO_APPLICABLE_RULE]: 'No registered rule addresses this operation.',
  [DENIAL_CODES.GOVERNED_BUT_UNMATCHED]: 'Rules address this operation, but none of their conditions matched.'
}

/**
 * Error type produced by the policy engine on a DENY verdict.
 */
export default class PolicyViolationError extends Error {
  #policyId
  #ruleName
  #reason
  #code

  /**
   * Constructs the error from the identifying set of the policy verdict.
   *
   * @param {PolicyVerdict} verdict - The verdict identifying which policy, which rule, why, and which denial path.
   */
  constructor ({ policyId, ruleName, reason, code }) {
    super(buildMessage({ policyId, ruleName, reason, code }))

    this.name = 'PolicyViolationError'
    this.#policyId = policyId
    this.#ruleName = ruleName
    this.#reason = reason
    this.#code = code
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

  /**
   * Which denial path produced the verdict. Switch on this rather than on
   * `reason`, which carries consumer-authored rule text for `RULE_DENIED`.
   * @returns {DenialCode}
   */
  get code () { return this.#code }
}

/**
 * Builds the error message for a verdict.
 *
 * The two default-deny paths get an explanatory message: a consumer who
 * registered one restrictive rule and then found unrelated operations blocked
 * needs to know the engine denies unmatched operations by design, and how to
 * opt out. A verdict from a rule that actually fired keeps the terse
 * `policy/rule` form — the consumer wrote that rule and knows what it means.
 *
 * @param {PolicyVerdict} verdict - The verdict to describe.
 * @returns {string} The message to construct the error with.
 */
function buildMessage ({ policyId, ruleName, reason, code }) {
  const diagnosis = DEFAULT_DENY_DIAGNOSIS[code]

  if (diagnosis === undefined) {
    const suffix = reason && reason !== ruleName ? `: ${reason}` : ''

    return `Policy violation: ${policyId}/${ruleName}${suffix}`
  }

  return [
    'Policy violation: this operation was denied because no policy rule explicitly allowed it.',
    diagnosis,
    'The engine defaults to deny for unmatched operations to prevent restriction bypass via other operations (e.g. sendTransaction calldata, approve, sign, signAuthorization).',
    'To opt into permissive semantics, register a catch-all ALLOW rule and layer specific DENY rules on top:',
    CATCH_ALL_SNIPPET
  ].join('\n\n')
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
