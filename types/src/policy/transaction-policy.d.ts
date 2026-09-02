/**
 * The verdict a transaction policy produces for an operation it matched.
 *
 * - `allow` — permit. An active vote.
 * - `deny` — block. An active vote; DENY wins over any ALLOW. `reason` is required.
 * - `abstain` — the policy addressed the operation but cannot judge it. Not
 *   a vote: the engine records it for audit and falls through to other
 *   policies and to its default-deny rule.
 */
export type TransactionPolicyVerdict = {
    outcome: 'allow';
    reason?: string;
} | {
    outcome: 'deny';
    reason: string;
} | {
    outcome: 'abstain';
    reason?: string;
};
/**
 * Abstract base for code-defined transaction policies. The engine drives
 * `match` → `evaluate` → `commit` (before the underlying call runs) and
 * `rollback` (if the call throws or is later reverted).
 *
 * All four methods are asynchronous so that implementations which need a
 * lookup can fulfil the contract. The engine serializes the
 * decide-and-commit window across concurrent calls.
 *
 * Only `evaluate` must be implemented by subclasses; `match` defaults to
 * matching every operation, `commit` and `rollback` default to no-op for
 * policies without cumulative state.
 */
export default abstract class TransactionPolicy {
    /**
     * Should this policy address the given operation? Resolve `false` to opt
     * out: the engine will not call `evaluate` and this policy contributes
     * no verdict for this call.
     *
     * @param {OperationRecord} op - The intercepted operation.
     * @returns {Promise<boolean>} `true` if this policy has an opinion on `op`.
     */
    match(op: OperationRecord): Promise<boolean>;
    /**
     * Resolve the verdict for an operation this policy matched. Must not
     * mutate policy state; commits happen in `commit(op)`.
     *
     * @param {OperationRecord} op - The intercepted operation (already passed `match`).
     * @returns {Promise<TransactionPolicyVerdict>} The verdict for this operation.
     */
    abstract evaluate(op: OperationRecord): Promise<TransactionPolicyVerdict>;
    /**
     * Called by the engine once every matched policy has allowed the
     * operation, immediately before the underlying call runs. This is where
     * cumulative counters advance.
     *
     * @param {OperationRecord} op - The operation about to execute.
     */
    commit(op: OperationRecord): Promise<void>;
    /**
     * Called by the engine to undo a prior `commit`: the underlying call
     * threw, a sibling in a batch was denied after this one committed, or a
     * broadcast later reverted on-chain.
     *
     * @param {OperationRecord} op - The operation whose commit should be undone.
     */
    rollback(op: OperationRecord): Promise<void>;
}
export type OperationRecord = import("./operation-record.js").OperationRecord;
