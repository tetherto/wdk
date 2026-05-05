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

import { ACTIONS, OPERATIONS, OPERATIONS_SET, SCOPES, WILDCARD } from './constants.js'
import { PolicyConfigurationError } from './policy-error.js'

const ACTIONS_SET = new Set(ACTIONS)
const SCOPES_SET = new Set(SCOPES)

function isPlainObject (value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString (value) {
  return typeof value === 'string' && value.length > 0
}

function isStringArray (value) {
  return Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString)
}

function isOperationName (value) {
  return value === WILDCARD || OPERATIONS_SET.has(value)
}

/**
 * Normalises the chain argument from a registerPolicy call into an array of
 * non-empty strings or `undefined` (meaning "apply to every registered chain").
 *
 * @internal
 * @param {string | string[] | undefined} chain
 * @returns {string[] | undefined}
 */
export function normaliseChainArg (chain) {
  if (chain === undefined) {
    return undefined
  }

  if (typeof chain === 'string') {
    if (chain.length === 0) {
      throw new PolicyConfigurationError('registerPolicy: chain must be a non-empty string.')
    }

    return [chain]
  }

  if (Array.isArray(chain) && chain.length > 0 && chain.every(isNonEmptyString)) {
    return Array.from(new Set(chain))
  }

  throw new PolicyConfigurationError('registerPolicy: chain must be a string or a non-empty array of strings.')
}

/**
 * Validates a registerPolicy options bag (currently only `state`, reserved for Phase 2).
 *
 * @internal
 * @param {object | undefined} options
 */
export function validateRegisterOptions (options) {
  if (options === undefined) return

  if (!isPlainObject(options)) {
    throw new PolicyConfigurationError('registerPolicy options: must be an object.')
  }

  if (options.state !== undefined && !isPlainObject(options.state)) {
    throw new PolicyConfigurationError("registerPolicy options: 'state' must be an object.")
  }
}

/**
 * Validates a single policy object. Throws synchronously on the first failure.
 *
 * @internal
 * @param {object} policy - The policy to validate.
 * @param {string[] | undefined} chains - The chain(s) the policy is being registered for, after normalisation.
 */
export function validatePolicy (policy, chains) {
  if (!isPlainObject(policy)) {
    throw new PolicyConfigurationError('Policy: must be an object.')
  }

  if (!isNonEmptyString(policy.id)) {
    throw new PolicyConfigurationError("Policy: 'id' is required and must be a non-empty string.")
  }

  if (!isNonEmptyString(policy.name)) {
    throw new PolicyConfigurationError(`Policy '${policy.id}': 'name' is required and must be a non-empty string.`)
  }

  if (!SCOPES_SET.has(policy.scope)) {
    throw new PolicyConfigurationError(`Policy '${policy.id}': 'scope' must be one of: ${SCOPES.join(', ')}.`)
  }

  if (policy.scope === 'account') {
    if (!isStringArray(policy.accounts)) {
      throw new PolicyConfigurationError(`Policy '${policy.id}': 'accounts' is required and must be a non-empty array of derivation paths when scope is 'account'.`)
    }

    if (chains === undefined) {
      throw new PolicyConfigurationError(`Policy '${policy.id}': account-scope policies must be registered with a chain argument.`)
    }
  } else if (policy.accounts !== undefined) {
    throw new PolicyConfigurationError(`Policy '${policy.id}': 'accounts' is only allowed when scope is 'account'.`)
  }

  if (policy.scope === 'wallet' && chains === undefined) {
    throw new PolicyConfigurationError(`Policy '${policy.id}': wallet-scope policies must be registered with a chain argument.`)
  }

  if (!Array.isArray(policy.rules) || policy.rules.length === 0) {
    throw new PolicyConfigurationError(`Policy '${policy.id}': 'rules' must be a non-empty array.`)
  }

  for (const rule of policy.rules) {
    validateRule(rule, policy)
  }
}

function validateRule (rule, policy) {
  if (!isPlainObject(rule)) {
    throw new PolicyConfigurationError(`Rule in policy '${policy.id}': rule must be an object.`)
  }

  if (!isNonEmptyString(rule.name)) {
    throw new PolicyConfigurationError(`Rule in policy '${policy.id}': 'name' is required and must be a non-empty string.`)
  }

  validateOperation(rule, policy)

  if (!ACTIONS_SET.has(rule.action)) {
    throw new PolicyConfigurationError(`Rule '${rule.name}' in policy '${policy.id}': 'action' must be 'ALLOW' or 'DENY'.`)
  }

  if (rule.override_broader_scope !== undefined) {
    if (typeof rule.override_broader_scope !== 'boolean') {
      throw new PolicyConfigurationError(`Rule '${rule.name}' in policy '${policy.id}': 'override_broader_scope' must be a boolean.`)
    }

    if (rule.override_broader_scope === true && (policy.scope !== 'account' || rule.action !== 'ALLOW')) {
      throw new PolicyConfigurationError(`Rule '${rule.name}' in policy '${policy.id}': 'override_broader_scope' is only valid on account-scope ALLOW rules.`)
    }
  }

  if (rule.reason !== undefined && !isNonEmptyString(rule.reason)) {
    throw new PolicyConfigurationError(`Rule '${rule.name}' in policy '${policy.id}': 'reason' must be a non-empty string.`)
  }

  if (!Array.isArray(rule.conditions)) {
    throw new PolicyConfigurationError(`Rule '${rule.name}' in policy '${policy.id}': 'conditions' must be an array.`)
  }

  for (let i = 0; i < rule.conditions.length; i++) {
    if (typeof rule.conditions[i] !== 'function') {
      throw new PolicyConfigurationError(`Rule '${rule.name}' in policy '${policy.id}': condition at index ${i} must be a function.`)
    }
  }
}

function validateOperation (rule, policy) {
  if (typeof rule.operation === 'string') {
    if (rule.operation.length === 0) {
      throw new PolicyConfigurationError(`Rule '${rule.name}' in policy '${policy.id}': 'operation' must be a string or non-empty array of strings.`)
    }

    if (!isOperationName(rule.operation)) {
      throw new PolicyConfigurationError(`Rule '${rule.name}' in policy '${policy.id}': unknown operation '${rule.operation}'. Supported: ${OPERATIONS.join(', ')}, ${WILDCARD}.`)
    }

    return
  }

  if (Array.isArray(rule.operation)) {
    if (rule.operation.length === 0) {
      throw new PolicyConfigurationError(`Rule '${rule.name}' in policy '${policy.id}': 'operation' must be a string or non-empty array of strings.`)
    }

    for (const op of rule.operation) {
      if (!isNonEmptyString(op)) {
        throw new PolicyConfigurationError(`Rule '${rule.name}' in policy '${policy.id}': 'operation' must be a string or non-empty array of strings.`)
      }

      if (!isOperationName(op)) {
        throw new PolicyConfigurationError(`Rule '${rule.name}' in policy '${policy.id}': unknown operation '${op}'. Supported: ${OPERATIONS.join(', ')}, ${WILDCARD}.`)
      }
    }

    return
  }

  throw new PolicyConfigurationError(`Rule '${rule.name}' in policy '${policy.id}': 'operation' must be a string or non-empty array of strings.`)
}

/**
 * Returns true if the given rule addresses the supplied operation.
 *
 * @internal
 * @param {object} rule
 * @param {string} operation
 * @returns {boolean}
 */
export function ruleAddressesOperation (rule, operation) {
  if (rule.operation === operation || rule.operation === WILDCARD) return true

  if (Array.isArray(rule.operation)) {
    return rule.operation.includes(operation) || rule.operation.includes(WILDCARD)
  }

  return false
}

/**
 * Returns the union of operation names referenced by the given policies.
 * If any rule uses the wildcard, the result includes the full operation set.
 *
 * @internal
 * @param {Iterable<object>} policies
 * @returns {Set<string>}
 */
export function collectReferencedOperations (policies) {
  const out = new Set()
  let wildcard = false

  for (const policy of policies) {
    for (const rule of policy.rules) {
      if (Array.isArray(rule.operation)) {
        for (const op of rule.operation) {
          if (op === WILDCARD) {
            wildcard = true
          } else {
            out.add(op)
          }
        }
      } else if (rule.operation === WILDCARD) {
        wildcard = true
      } else {
        out.add(rule.operation)
      }
    }
  }

  if (wildcard) {
    for (const op of OPERATIONS) out.add(op)
  }

  return out
}
