/**
 * A rule-shaped policy definition (the object accepted by `registerPolicy`)
 * implemented as a `TransactionPolicy`.
 *
 * Reuses the engine's own validation, registry, context building and
 * evaluator, so within a single policy the semantics are exactly those of
 * today's engine. Verdict mapping: evaluator `ALLOW` → `allow`; `BLOCK` from
 * a matching DENY rule → `deny`; `BLOCK` because no rule's conditions held →
 * `abstain`. `commit` and `rollback` are no-ops.
 */
export default class RulePolicy extends TransactionPolicy {
    /**
     * Validates the definition and options exactly as `registerPolicy` does,
     * then stores a defensive clone tagged with the condition timeout.
     *
     * @param {Policy} definition - The rule-shaped policy definition.
     * @param {RegisterPolicyOptions} [options] - Settings such as `conditionTimeoutMs`.
     * @throws {PolicyConfigurationError} If the definition or options fail schema validation.
     */
    constructor(definition: Policy, options?: RegisterPolicyOptions);
    /**
     * The definition's `id`.
     * @returns {string}
     */
    get id(): string;
    /**
     * The definition's human-readable `name`.
     * @returns {string}
     */
    get name(): string;
    /**
     * The definition's scope.
     * @returns {PolicyScope}
     */
    get scope(): PolicyScope;
    /**
     * Resolves `true` when the definition binds to the call's wallet (and,
     * for account scope, its path or index) and at least one rule addresses
     * the call's method.
     *
     * @param {OperationRecord} op - The intercepted operation.
     * @returns {Promise<boolean>}
     */
    match(op: OperationRecord): Promise<boolean>;
    /**
     * Runs the definition's rules through the engine's evaluator against a
     * `PolicyContext` built from the record and maps the outcome.
     *
     * @param {OperationRecord} op - The intercepted operation.
     * @returns {Promise<TransactionPolicyVerdict>}
     * @throws {PolicyConfigurationError} If any argument on the record is not structured-cloneable.
     */
    evaluate(op: OperationRecord): Promise<TransactionPolicyVerdict>;
    #private;
}
import TransactionPolicy from "./transaction-policy.js";
export type Policy = import("./policy-engine.js").Policy;
export type PolicyScope = import("./policy-engine.js").PolicyScope;
export type RegisterPolicyOptions = import("./policy-engine.js").RegisterPolicyOptions;
export type OperationRecord = import("./operation-record.js").OperationRecord;
export type TransactionPolicyVerdict = import("./transaction-policy.js").TransactionPolicyVerdict;
