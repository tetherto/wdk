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
export function evaluate(context: object, groups: {
    account: object[];
    wallet: object[];
    project: object[];
}): Promise<{
    outcome: string;
    policyId: any;
    ruleName: any;
    reason: any;
    trace: any;
}>;
