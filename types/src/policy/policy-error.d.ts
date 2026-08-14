/**
 * Error type produced by the policy engine on a DENY verdict.
 */
export default class PolicyViolationError extends Error {
    /**
     * Constructs the error from the identifying set of the policy verdict.
     *
     * @param {PolicyVerdict} verdict - The verdict identifying which policy, which rule, why, and which denial path.
     */
    constructor({ policyId, ruleName, reason, code }: PolicyVerdict);
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
    /**
     * Which denial path produced the verdict. Switch on this rather than on
     * `reason`, which carries consumer-authored rule text for `RULE_DENIED`.
     * @returns {DenialCode}
     */
    get code(): DenialCode;
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
 * Machine-readable discriminator for why the engine blocked an operation.
 * `RULE_DENIED` means a DENY rule matched. The other two are the default-deny
 * paths: `NO_APPLICABLE_RULE` when no registered rule addresses the operation
 * at all, `GOVERNED_BUT_UNMATCHED` when rules address it but no condition set
 * matched.
 */
export type DenialCode = "RULE_DENIED" | "NO_APPLICABLE_RULE" | "GOVERNED_BUT_UNMATCHED";
/**
 * The identifying set a DENY verdict carries: which policy, which rule, the
 * human-readable reason, and the machine-readable denial code.
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
    /**
     * - Which denial path produced the verdict.
     */
    code: DenialCode;
};
