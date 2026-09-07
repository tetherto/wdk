export const DEFAULT_POLICY_EXCLUSIONS: readonly string[];
export const WILDCARD: "*";
export const SCOPES: string[];
export const ACTIONS: string[];
/**
 * The runtime values of `DenialCode`, keyed by name.
 */
export const DENIAL_CODES: Readonly<{
    RULE_DENIED: "RULE_DENIED";
    NO_APPLICABLE_RULE: "NO_APPLICABLE_RULE";
    GOVERNED_BUT_UNMATCHED: "GOVERNED_BUT_UNMATCHED";
}>;
