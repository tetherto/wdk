/**
 * Normalises the chain argument from a registerPolicy call into an array of
 * non-empty strings or `undefined` (meaning "apply to every registered chain").
 *
 * @internal
 * @param {string | string[] | undefined} chain
 * @returns {string[] | undefined}
 */
export function normaliseChainArg(chain: string | string[] | undefined): string[] | undefined;
/**
 * Validates a registerPolicy options bag (currently only `state`, reserved for Phase 2).
 *
 * @internal
 * @param {object | undefined} options
 */
export function validateRegisterOptions(options: object | undefined): void;
/**
 * Validates a single policy object. Throws synchronously on the first failure.
 *
 * @internal
 * @param {object} policy - The policy to validate.
 * @param {string[] | undefined} chains - The chain(s) the policy is being registered for, after normalisation.
 */
export function validatePolicy(policy: object, chains: string[] | undefined): void;
/**
 * Returns true if the given rule addresses the supplied operation.
 *
 * @internal
 * @param {object} rule
 * @param {string} operation
 * @returns {boolean}
 */
export function ruleAddressesOperation(rule: object, operation: string): boolean;
/**
 * Returns the union of operation names referenced by the given policies.
 * If any rule uses the wildcard, the result includes the full operation set.
 *
 * @internal
 * @param {Iterable<object>} policies
 * @returns {Set<string>}
 */
export function collectReferencedOperations(policies: Iterable<object>): Set<string>;
