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

import { z } from 'zod'

import { ACTIONS, OPERATIONS, SCOPES, WILDCARD } from './constants.js'

/** @typedef {import('zod').ZodError} ZodError */
/** @typedef {import('./policy-engine.js').Policy} Policy */

const OPERATION_NAMES = [...OPERATIONS, WILDCARD]

const operationField = z.union([
  z.enum(OPERATION_NAMES),
  z.array(z.enum(OPERATION_NAMES)).nonempty()
])

const accountIdentifier = z.union([
  z.string().min(1),
  z.number().int().nonnegative()
])

const conditionFunction = z.custom((v) => typeof v === 'function')

const ruleSchema = z.object({
  name: z.string().min(1),
  reason: z.string().min(1).optional(),
  operation: operationField,
  action: z.enum(ACTIONS),
  override_broader_scope: z.boolean().optional(),
  conditions: z.array(conditionFunction),
  state: z.unknown().optional(),
  onSuccess: conditionFunction.optional()
})

const walletField = z.union([
  z.string().min(1),
  z.array(z.string().min(1)).nonempty()
]).optional()

/**
 * Zod schema for a single policy object. Validates id/name/scope/rules and
 * enforces cross-field rules (account-scope requirements, override constraint)
 * via a superRefine.
 */
export const policySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  scope: z.enum(SCOPES),
  wallet: walletField,
  accounts: z.array(accountIdentifier).nonempty().optional(),
  rules: z.array(ruleSchema).nonempty()
}).superRefine((policy, ctx) => {
  if (policy.scope === 'account') {
    if (policy.accounts === undefined) {
      ctx.addIssue({ code: 'custom', path: ['accounts'], message: "'accounts' is required when scope is 'account'" })
    }
    if (policy.wallet === undefined) {
      ctx.addIssue({ code: 'custom', path: ['wallet'], message: "'wallet' is required when scope is 'account'" })
    }
  } else if (policy.accounts !== undefined) {
    ctx.addIssue({ code: 'custom', path: ['accounts'], message: "'accounts' is only allowed when scope is 'account'" })
  }

  policy.rules?.forEach((rule, i) => {
    if (rule.override_broader_scope === true && (policy.scope !== 'account' || rule.action !== 'ALLOW')) {
      ctx.addIssue({
        code: 'custom',
        path: ['rules', i, 'override_broader_scope'],
        message: "'override_broader_scope' is only valid on account-scope ALLOW rules"
      })
    }
  })
})

/**
 * Zod schema for the optional `registerPolicy` options bag.
 */
export const registerOptionsSchema = z.object({
  state: z.record(z.string(), z.unknown()).optional(),
  conditionTimeoutMs: z.number().finite().positive().optional()
}).optional()

/**
 * Zod schema for the optional engine options bag accepted by the `WDK`
 * and `PolicyEngine` constructors.
 */
export const engineOptionsSchema = z.object({
  maxConditionTimeoutMs: z.number().finite().positive().optional()
}).optional()

/**
 * Normalises the wallet field of a parsed policy into an array of
 * non-empty strings or `undefined` (meaning "apply to every registered wallet").
 *
 * @internal
 * @param {string | string[] | undefined} wallet - The raw `wallet` field from a parsed policy.
 * @returns {string[] | undefined} Normalised wallet list, or undefined for "all wallets".
 */
export function normalisePolicyWallet (wallet) {
  if (wallet === undefined) return undefined
  if (typeof wallet === 'string') return [wallet]
  return Array.from(new Set(wallet))
}

/**
 * Builds a human-readable message for the first issue in a ZodError,
 * prefixed with the policy (and rule, when applicable) context.
 *
 * @internal
 * @param {ZodError} zodError - The error returned by `policySchema.safeParse`.
 * @param {Policy} policy - The policy candidate that failed validation; used to look up id and rule names for the prefix.
 * @returns {string} A human-readable message prefixed with the policy (and rule, where applicable) context.
 */
export function formatPolicyError (zodError, policy) {
  const issue = zodError.issues[0]
  const { path, message } = issue

  const id = policy?.id
  const policyLabel = typeof id === 'string' && id.length > 0 ? `Policy '${id}'` : 'Policy'

  if (path[0] === 'rules' && path.length > 1) {
    const rule = policy?.rules?.[path[1]]
    const ruleName = rule?.name
    const ruleLabel = typeof ruleName === 'string' && ruleName.length > 0
      ? `Rule '${ruleName}' in policy '${id}'`
      : `Rule in policy '${id}'`
    const subPath = path.slice(2).join('.')

    return `${ruleLabel}${subPath ? `: '${subPath}'` : ''}: ${message}`
  }

  const pathStr = path.join('.')

  return `${policyLabel}${pathStr ? `: '${pathStr}'` : ''}: ${message}`
}

/**
 * Builds a human-readable message for the first issue in a ZodError thrown
 * by the registerOptions schema.
 *
 * @internal
 * @param {ZodError} zodError - The error returned by `registerOptionsSchema.safeParse`.
 * @returns {string} A human-readable message prefixed with `registerPolicy options`.
 */
export function formatRegisterOptionsError (zodError) {
  return formatOptionsError(zodError, 'registerPolicy options')
}

/**
 * Builds a human-readable message for the first issue in a ZodError thrown
 * by the engine options schema.
 *
 * @internal
 * @param {ZodError} zodError - The error returned by `engineOptionsSchema.safeParse`.
 * @returns {string} A human-readable message prefixed with `WDK options`.
 */
export function formatEngineOptionsError (zodError) {
  return formatOptionsError(zodError, 'WDK options')
}

function formatOptionsError (zodError, prefix) {
  const issue = zodError.issues[0]
  const pathStr = issue.path.join('.')

  return `${prefix}${pathStr ? `: '${pathStr}'` : ''}: ${issue.message}`
}
