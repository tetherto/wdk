/**
 * Error type produced by the policy engine on a DENY verdict.
 */
export default class PolicyViolationError extends Error {
    /**
     * Constructs the error from the identifying set of the policy verdict.
     *
     * @param {PolicyVerdict} verdict - The verdict the engine produced for the blocked operation.
     */
    constructor({ operation, policyId, ruleName, reason, code }: PolicyVerdict);
    /**
     * The name of the method the engine blocked.
     * @returns {string} The account or protocol method name, as it appears in a rule's `operation`.
     */
    get operation(): string;
    /**
     * The id of the policy that produced the verdict.
     * @returns {string} The policy id, or `<unknown>` on a default-deny verdict that no policy produced.
     */
    get policyId(): string;
    /**
     * The name of the rule within the policy that matched.
     * @returns {string} The rule name, or `<unknown>` on a default-deny verdict that no rule produced.
     */
    get ruleName(): string;
    /**
     * Human-readable explanation of why the operation was blocked.
     * @returns {string} The rule's own `reason` (or its name) when a rule fired; the engine's reason string otherwise.
     */
    get reason(): string;
    /**
     * Which denial path produced the verdict. Switch on this rather than on
     * `reason`, which carries consumer-authored rule text for `RULE_DENIED`.
     * @returns {DenialCode} The denial path, one of the `DENIAL_CODES` values.
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
 * The identifying set a DENY verdict carries.
 */
export type PolicyVerdict = {
    /**
     * - The name of the method that was blocked.
     */
    operation: string;
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
