/** @typedef {import('../wdk-manager.js').PolicyTarget} PolicyTarget */
/**
 * Error thrown when a registered policy rejects an operation.
 */
export class PolicyViolationError extends Error {
    /**
     * @param {string} policyName
     * @param {string} method
     * @param {PolicyTarget} target
     */
    constructor(policyName: string, method: string, target?: PolicyTarget);
    /** @type {string} */
    policy: string;
    /** @type {string} */
    method: string;
    /** @type {Object} */
    target: any;
}
export type PolicyTarget = import("../wdk-manager.js").PolicyTarget;
