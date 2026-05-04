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

/**
 * Evaluates a context against the three policy groups (account, wallet, project)
 * with DENY-wins, narrower-first semantics. Returns a structured verdict, never
 * throws on policy outcomes (it does throw on programmer errors).
 *
 * Outcome shape:
 *   { outcome: 'ALLOW' | 'BLOCK',
 *     policyId: string | null,
 *     ruleName: string | null,
 *     reason:   string | null,
 *     trace:    SimulationTraceEntry[] }
 *
 * @internal
 * @param {object} context
 * @param {{ account: object[], wallet: object[], project: object[] }} groups
 */
export async function evaluate (context, groups) {
  const trace = []

  const anyAddresses =
    addresses(groups.account, context.operation) ||
    addresses(groups.wallet, context.operation) ||
    addresses(groups.project, context.operation)

  if (!anyAddresses) {
    return makeAllow(null, null, 'not-governed', trace)
  }

  const recordedAllows = []

  const a = await evalGroup(groups.account, context, trace, 'account', { allowOverride: true })
  if (a.kind === 'DENY') return makeBlock(a.policyId, a.ruleName, a.reason, trace)
  if (a.kind === 'ALLOW_FINAL') return makeAllow(a.policyId, a.ruleName, 'override', trace)
  recordedAllows.push(...a.allows)

  const b = await evalGroup(groups.wallet, context, trace, 'wallet', { allowOverride: false })
  if (b.kind === 'DENY') return makeBlock(b.policyId, b.ruleName, b.reason, trace)
  recordedAllows.push(...b.allows)

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
    for (const rule of policy.rules) {
      if (!ruleAddressesOperation(rule, context.operation)) continue

      const { matched, error } = await evalConditions(rule.conditions, context)

      trace.push({
        scope,
        policyId: policy.id,
        ruleName: rule.name,
        matched,
        ...(error !== undefined ? { error } : {})
      })

      if (!matched) continue

      if (rule.action === 'DENY') {
        return { kind: 'DENY', policyId: policy.id, ruleName: rule.name, reason: rule.name }
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
 * developer-supplied code that can throw any value (sync or async). Treating
 * any throw as "rule does not engage" and recording it on the trace is the
 * safe default — a buggy condition must not be allowed to break the user's
 * transaction or accidentally engage other rules.
 */
async function evalConditions (conditions, context) {
  for (const condition of conditions) {
    try {
      const result = await condition(context)

      if (!result) return { matched: false, error: undefined }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)

      return { matched: false, error: message }
    }
  }

  return { matched: true, error: undefined }
}

function makeAllow (policyId, ruleName, reason, trace) {
  return { outcome: 'ALLOW', policyId, ruleName, reason, trace }
}

function makeBlock (policyId, ruleName, reason, trace) {
  return { outcome: 'BLOCK', policyId, ruleName, reason, trace }
}
