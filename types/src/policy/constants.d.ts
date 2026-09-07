export const DEFAULT_POLICY_EXCLUSIONS: readonly string[];
export const WILDCARD: "*";
export const SCOPES: string[];
export const ACTIONS: string[];
/**
 * Machine-readable discriminators for why the engine blocked an operation, surfaced as `PolicyViolationError.code`
 * and `SimulationResult.code`. `RULE_DENIED` means a DENY rule actually fired; the two no-match codes are the
 * default-deny paths and are what the explanatory error message keys off.
 */
export const DENIAL_CODES: Readonly<{
    RULE_DENIED: "RULE_DENIED";
    NO_APPLICABLE_RULE: "NO_APPLICABLE_RULE";
    GOVERNED_BUT_UNMATCHED: "GOVERNED_BUT_UNMATCHED";
}>;
