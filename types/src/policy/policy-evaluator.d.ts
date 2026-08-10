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
export function evaluate(context: PolicyContext, groups: PolicyGroups): Promise<Verdict>;
export type PolicyContext = import("./policy-engine.js").PolicyContext;
export type SimulationTraceEntry = import("./policy-engine.js").SimulationTraceEntry;
export type PolicyGroups = import("./policy-registry.js").PolicyGroups;
/**
 * The internal verdict produced by `evaluate()`: ALLOW or BLOCK, plus
 * the identifying triple and a per-rule trace.
 */
export type Verdict = {
    /**
     * - The evaluation outcome.
     */
    outcome: "ALLOW" | "BLOCK";
    /**
     * - Id of the policy that produced the verdict, or null when no rule addresses the operation (`no-applicable-rule`) or matched (`governed-but-unmatched`).
     */
    policyId: string | null;
    /**
     * - Name of the rule that matched, or null.
     */
    ruleName: string | null;
    /**
     * - Human-readable reason (rule.reason or one of `matched` / `override` / `no-applicable-rule` / `governed-but-unmatched`).
     */
    reason: string | null;
    /**
     * - Per-rule evaluation outcomes in order.
     */
    trace: SimulationTraceEntry[];
};
