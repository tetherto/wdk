/**
 * The identifying triple a DENY verdict carries: which policy, which rule,
 * and the human-readable reason.
 *
 * @typedef {Object} PolicyVerdict
 * @property {string} policyId - The id of the policy that produced the verdict.
 * @property {string} ruleName - The name of the matching rule.
 * @property {string} reason - Human-readable explanation of why the operation was blocked.
 */
/**
 * Error type produced by the policy engine on a DENY verdict.
 */
export default class PolicyViolationError extends Error {
    /**
     * Constructs the error from the identifying triple of the policy verdict.
     *
     * @param {PolicyVerdict} verdict - The verdict triple identifying which policy, which rule, and why.
     */
    constructor({ policyId, ruleName, reason }: PolicyVerdict);
    /**
     * The id of the policy that produced the verdict.
     * @returns {string}
     */
    get policyId(): string;
    /**
     * The name of the rule within the policy that matched.
     * @returns {string}
     */
    get ruleName(): string;
    /**
     * Human-readable explanation of why the operation was blocked.
     * @returns {string}
     */
    get reason(): string;
    #private;
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
    constructor(message: string);
}
/**
 * Structured context for a `PolicyAdapterError`.
 */
export type PolicyAdapterErrorOptions = {
    /**
     * - The wallet identifier the failing call was made against.
     */
    walletType?: string;
    /**
     * - The method name that was being interpreted.
     */
    method?: string;
    /**
     * - The underlying error thrown by the extractor, if any.
     */
    cause?: unknown;
};
/**
 * Error type produced when an adapter fails to produce a usable
 * `OperationRecord`: the extractor threw, or it returned a malformed record
 * (no `kind`). The engine treats this as fail-closed and denies the call.
 */
export class PolicyAdapterError extends Error {
    /**
     * Constructs the error with a description and optional structured context.
     *
     * @param {string} message - Human-readable description of the failure.
     * @param {PolicyAdapterErrorOptions} [options] - Structured context.
     */
    constructor(message: string, options?: PolicyAdapterErrorOptions);
    /**
     * The wallet identifier the failing call was made against, when known.
     * @returns {string | undefined}
     */
    get walletType(): string | undefined;
    /**
     * The method name that was being interpreted, when known.
     * @returns {string | undefined}
     */
    get method(): string | undefined;
    #private;
}
/**
 * The identifying triple a DENY verdict carries: which policy, which rule,
 * and the human-readable reason.
 */
export type PolicyVerdict = {
    /**
     * - The id of the policy that produced the verdict.
     */
    policyId: string;
    /**
     * - The name of the matching rule.
     */
    ruleName: string;
    /**
     * - Human-readable explanation of why the operation was blocked.
     */
    reason: string;
};
