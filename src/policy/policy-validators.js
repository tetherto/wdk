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

import { WILDCARD } from './constants.js'
import { PolicyConfigurationError } from './policy-error.js'
import {
  engineOptionsSchema,
  formatEngineOptionsError,
  formatPolicyError,
  formatRegisterOptionsError,
  normalisePolicyWallet,
  policySchema,
  registerOptionsSchema
} from './policy-schemas.js'

/** @typedef {import('./policy-engine.js').Policy} Policy */
/** @typedef {import('./policy-engine.js').PolicyEngineOptions} PolicyEngineOptions */
/** @typedef {import('./policy-engine.js').PolicyRule} PolicyRule */
/** @typedef {import('./policy-engine.js').RegisterPolicyOptions} RegisterPolicyOptions */

export { normalisePolicyWallet }

/**
 * Validates the options bag passed to registerPolicy.
 *
 * @internal
 * @param {RegisterPolicyOptions} [options] - Settings applied to the policies the call registers, such as `conditionTimeoutMs`.
 * @throws {PolicyConfigurationError} If `options` is not a plain object or any field fails schema validation.
 */
export function validateRegisterOptions (options) {
  if (options === undefined) return

  const result = registerOptionsSchema.safeParse(options)

  if (!result.success) {
    throw new PolicyConfigurationError(formatRegisterOptionsError(result.error))
  }
}

/**
 * Validates the options bag passed to the engine constructor.
 *
 * @internal
 * @param {PolicyEngineOptions} [options] - Engine-level settings such as `maxConditionTimeoutMs`.
 * @throws {PolicyConfigurationError} If `options` is not a plain object or any field fails schema validation.
 */
export function validateEngineOptions (options) {
  if (options === undefined) return

  const result = engineOptionsSchema.safeParse(options)

  if (!result.success) {
    throw new PolicyConfigurationError(formatEngineOptionsError(result.error))
  }
}

/**
 * Validates a single policy object and returns the normalised wallet binding.
 * Throws synchronously on the first failure.
 *
 * @internal
 * @param {Policy} policy - A user-supplied policy candidate; may be malformed.
 * @returns {string[] | undefined} The normalised wallet binding, or undefined for "all wallets".
 * @throws {PolicyConfigurationError} If the policy does not match the schema or violates a cross-field rule (account-scope requirements, override constraint).
 */
export function validatePolicy (policy) {
  const result = policySchema.safeParse(policy)

  if (!result.success) {
    throw new PolicyConfigurationError(formatPolicyError(result.error, policy))
  }

  return normalisePolicyWallet(result.data.wallet)
}

/**
 * Returns true if the given rule addresses the supplied operation.
 *
 * @internal
 * @param {PolicyRule} rule - The rule under evaluation.
 * @param {string} operation - The operation name being checked (e.g. 'sendTransaction').
 * @returns {boolean} True if the rule's operation field includes this operation (literal or via wildcard).
 */
export function ruleAddressesOperation (rule, operation) {
  if (rule.operation === operation || rule.operation === WILDCARD) return true

  if (Array.isArray(rule.operation)) {
    return rule.operation.includes(operation) || rule.operation.includes(WILDCARD)
  }

  return false
}
