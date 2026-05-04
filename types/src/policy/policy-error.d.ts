/**
 * Thrown by a wrapped wallet account method when a registered policy blocks
 * the attempted operation. Carries the policy id, rule name, and a
 * human-readable reason so callers (developers, agent runtimes) can react.
 */
export default class PolicyViolationError extends Error {
    /**
     * @param {string} policyId - The id of the policy that produced the verdict.
     * @param {string} ruleName - The name of the matching rule.
     * @param {string} reason - A human-readable explanation.
     */
    constructor(policyId: string, ruleName: string, reason: string);
    /** @type {string} */
    policyId: string;
    /** @type {string} */
    ruleName: string;
    /** @type {string} */
    reason: string;
}
/**
 * Thrown synchronously by registerPolicy() and the underlying validators when
 * a policy or registration call is malformed (unknown operation, missing
 * required field, contradictory configuration, etc.). Distinct from
 * PolicyViolationError, which fires at runtime when a registered policy
 * blocks a transaction.
 */
export class PolicyConfigurationError extends Error {
    /**
     * @param {string} message - Human-readable explanation of the configuration problem.
     */
    constructor(message: string);
}
