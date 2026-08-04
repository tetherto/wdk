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

import { ruleAddressesOperation } from './policy-validators.js'

/** @typedef {import('./policy-engine.js').PolicyContext} PolicyContext */
/** @typedef {import('./policy-engine.js').SimulationTraceEntry} SimulationTraceEntry */
/** @typedef {import('./policy-registry.js').PolicyGroups} PolicyGroups */

/**
 * The internal verdict produced by `evaluate()`: ALLOW or BLOCK, plus
 * the identifying triple and a per-rule trace.
 *
 * @typedef {Object} Verdict
 * @property {'ALLOW' | 'BLOCK'} outcome - The evaluation outcome.
 * @property {string | null} policyId - Id of the policy that produced the verdict, or null when no rule addresses the operation (`no-applicable-rule`) or matched (`governed-but-unmatched`).
 * @property {string | null} ruleName - Name of the rule that matched, or null.
 * @property {string | null} reason - Human-readable reason (rule.reason or one of `matched` / `override` / `no-applicable-rule` / `governed-but-unmatched`).
 * @property {SimulationTraceEntry[]} trace - Per-rule evaluation outcomes in order.
 */

/**
 * Evaluates a context against the two policy groups (account, project)
 * with DENY-wins, narrower-first semantics. Returns a structured verdict,
 * never throws on policy outcomes (it does throw on programmer errors).
 *
 * @internal
 * @param {PolicyContext} context - The frozen context built for this call.
 * @param {PolicyGroups} groups - Pre-filtered policies applicable to the (wallet, path, index) tuple, partitioned by scope. Each carries the condition timeout it was registered with.
 * @returns {Promise<Verdict>} The verdict, including a trace of all rules considered.
 */
export async function evaluate (context, groups) {
  const trace = []

  const anyAddresses =
    addresses(groups.account, context.operation) ||
    addresses(groups.project, context.operation)

  // Default-deny semantics: any account the proxy wraps is governed (at
  // least one policy applies). If no rule addresses this specific operation,
  // BLOCK rather than ALLOW — otherwise a "cap transfer" policy would do
  // nothing about sibling money-movement methods (sendTransaction with
  // ERC-20 calldata, signTypedData for Permit, delegate, etc.).
  //
  // To opt back into permissive semantics, register a wildcard ALLOW:
  //   { operation: '*', action: 'ALLOW', conditions: [] }
  if (!anyAddresses) {
    return makeBlock(null, null, 'no-applicable-rule', trace)
  }

  const recordedAllows = []

  const a = await evalGroup(groups.account, context, trace, 'account', { allowOverride: true })
  if (a.kind === 'DENY') return makeBlock(a.policyId, a.ruleName, a.reason, trace)
  if (a.kind === 'ALLOW_FINAL') return makeAllow(a.policyId, a.ruleName, 'override', trace)
  recordedAllows.push(...a.allows)

  const c = await evalGroup(groups.project, context, trace, 'project', { allowOverride: false })
  if (c.kind === 'DENY') return makeBlock(c.policyId, c.ruleName, c.reason, trace)
  recordedAllows.push(...c.allows)

  if (recordedAllows.length > 0) {
    const first = recordedAllows[0]

    return makeAllow(first.policyId, first.ruleName, 'matched', trace)
  }

  return makeBlock(null, null, 'governed-but-unmatched', trace)
}

function addresses (policies, operation) {
  for (const policy of policies) {
    for (const rule of policy.rules) {
      if (ruleAddressesOperation(rule, operation)) return true
    }
  }

  return false
}

async function evalGroup (policies, context, trace, scope, { allowOverride }) {
  const allows = []

  for (const policy of policies) {
    const conditionTimeoutMs = policy._conditionTimeoutMs

    for (const rule of policy.rules) {
      if (!ruleAddressesOperation(rule, context.operation)) continue

      const failClose = rule.action === 'DENY'
      const { matched, error } = await evalConditions(rule.conditions, context, { conditionTimeoutMs, failClose })

      trace.push({
        scope,
        policy_id: policy.id,
        rule_name: rule.name,
        matched,
        ...(error !== undefined ? { error } : {})
      })

      if (!matched) continue

      if (rule.action === 'DENY') {
        const reason = error !== undefined
          ? (rule.reason ?? `${rule.name} (condition error: ${error})`)
          : (rule.reason ?? rule.name)

        return { kind: 'DENY', policyId: policy.id, ruleName: rule.name, reason }
      }

      if (allowOverride && rule.override_broader_scope === true) {
        return { kind: 'ALLOW_FINAL', policyId: policy.id, ruleName: rule.name }
      }

      allows.push({ policyId: policy.id, ruleName: rule.name })
    }
  }

  return { kind: 'CONTINUE', allows }
}

/**
 * Evaluates a rule's conditions in order, short-circuiting on the first false.
 *
 * The catch is deliberately broad: condition functions are arbitrary
 * developer-supplied code that can throw any value (sync or async).
 *
 * Fail mode depends on rule action:
 *   - ALLOW rules: a throwing condition is treated as no-match (fail-open as
 *     non-engagement). The DENY-wins layer above still ensures we err safe
 *     when a sibling DENY catches it.
 *   - DENY rules: a throwing condition is treated as a match (fail-closed).
 *     This prevents an attacker from bypassing a DENY by causing its
 *     backing service (e.g. KYT lookup) to throw — when uncertainty
 *     surrounds a deny, block.
 *
 * Each condition is also raced against the timeout its owning policy was
 * registered with. A timeout is surfaced as a throw and follows the same
 * fail-mode rules above.
 */
async function evalConditions (conditions, context, { conditionTimeoutMs, failClose }) {
  for (const condition of conditions) {
    try {
      const result = await withTimeout(Promise.resolve(condition(context)), conditionTimeoutMs)

      if (!result) return { matched: false, error: undefined }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)

      return { matched: failClose, error: message }
    }
  }

  return { matched: true, error: undefined }
}

async function withTimeout (promise, ms) {
  let timer

  const timeoutPromise = new Promise((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`condition timed out after ${ms}ms`)), ms)

    if (typeof timer.unref === 'function') timer.unref()
  })

  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    clearTimeout(timer)
  }
}

function makeAllow (policyId, ruleName, reason, trace) {
  return { outcome: 'ALLOW', policyId, ruleName, reason, trace }
}

function makeBlock (policyId, ruleName, reason, trace) {
  return { outcome: 'BLOCK', policyId, ruleName, reason, trace }
}
