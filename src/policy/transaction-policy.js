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

import { NotImplementedError } from '@tetherto/wdk-wallet'

/** @typedef {import('./operation-record.js').OperationRecord} OperationRecord */

/**
 * The verdict a transaction policy produces for an operation it matched.
 *
 * - `allow` — permit. An active vote.
 * - `deny` — block. An active vote; DENY wins over any ALLOW. `reason` is required.
 * - `abstain` — the policy addressed the operation but cannot judge it (for
 *   example, the amount could not be determined and the policy is configured
 *   to skip rather than fail closed). Not a vote: the engine records it for
 *   audit and falls through to other policies and to its default-deny rule.
 *   Distinct from `match(op) === false`, which means the operation was never
 *   this policy's concern.
 *
 * @typedef {{ outcome: 'allow', reason?: string } | { outcome: 'deny', reason: string } | { outcome: 'abstain', reason?: string }} TransactionPolicyVerdict
 */

/**
 * Abstract base for code-defined transaction policies. The engine drives
 * `match` → `evaluate` → `commit` (before the underlying call runs) and
 * `rollback` (if the call throws or is later reverted).
 *
 * Rule-shaped policies (the `Policy` definition object accepted by
 * `registerPolicy`) are one implementation of this contract; policies with
 * cumulative state, such as a spending cap, are another. Both compose under
 * the same DENY-wins, default-deny evaluation.
 *
 * All four methods are asynchronous so that implementations which need a
 * lookup (an on-chain allowlist, a decoder that fetches an ABI, the condition
 * functions of a rule-shaped policy) can fulfil the contract. The engine
 * serializes the decide-and-commit window across concurrent calls so that two
 * operations cannot both pass a cumulative check that only one of them should.
 *
 * Only `evaluate` must be implemented by subclasses; `match` defaults to
 * matching every operation, `commit` and `rollback` default to no-op for
 * policies without cumulative state.
 *
 * @abstract
 */
export default class TransactionPolicy {
  /**
   * Should this policy address the given operation? Resolve `false` to opt
   * out: the engine will not call `evaluate` and this policy contributes
   * no verdict for this call.
   *
   * The default matches every operation. Override to scope your policy to
   * specific kinds, assets, methods, or wallets.
   *
   * @param {OperationRecord} op - The intercepted operation.
   * @returns {Promise<boolean>} `true` if this policy has an opinion on `op`.
   */
  async match (op) {
    return true
  }

  /**
   * Resolve the verdict for an operation this policy matched. Must not
   * mutate policy state; commits happen in `commit(op)`.
   *
   * @abstract
   * @param {OperationRecord} op - The intercepted operation (already passed `match`).
   * @returns {Promise<TransactionPolicyVerdict>} The verdict for this operation.
   * @throws {NotImplementedError} Always, on the abstract base.
   */
  async evaluate (op) {
    throw new NotImplementedError('evaluate(op)')
  }

  /**
   * Called by the engine once every matched policy has allowed the
   * operation, immediately before the underlying call runs. This is where
   * cumulative counters advance. Default is a no-op for policies without
   * cumulative state.
   *
   * @param {OperationRecord} op - The operation about to execute.
   * @returns {Promise<void>}
   */
  async commit (op) {
  }

  /**
   * Called by the engine to undo a prior `commit`: the underlying call
   * threw, a sibling in a batch was denied after this one committed, or a
   * broadcast later reverted on-chain. Default is a no-op. Policies that
   * implement `commit` should implement `rollback` symmetrically.
   *
   * @param {OperationRecord} op - The operation whose commit should be undone.
   * @returns {Promise<void>}
   */
  async rollback (op) {
  }
}
