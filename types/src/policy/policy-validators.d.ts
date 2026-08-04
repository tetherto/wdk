/**
 * Validates the options bag passed to registerPolicy.
 *
 * @internal
 * @param {RegisterPolicyOptions} [options] - Settings applied to the policies the call registers, such as `conditionTimeoutMs`.
 * @throws {PolicyConfigurationError} If `options` is not a plain object or any field fails schema validation.
 */
export function validateRegisterOptions(options?: RegisterPolicyOptions): void;
/**
 * Validates the options bag passed to the engine constructor.
 *
 * @internal
 * @param {PolicyEngineOptions} [options] - Engine-level settings such as `maxConditionTimeoutMs`.
 * @throws {PolicyConfigurationError} If `options` is not a plain object or any field fails schema validation.
 */
export function validateEngineOptions(options?: PolicyEngineOptions): void;
/**
 * Validates a single policy object and returns the normalised wallet binding.
 * Throws synchronously on the first failure.
 *
 * @internal
 * @param {Policy} policy - A user-supplied policy candidate; may be malformed.
 * @returns {string[] | undefined} The normalised wallet binding, or undefined for "all wallets".
 * @throws {PolicyConfigurationError} If the policy does not match the schema or violates a cross-field rule (account-scope requirements, override constraint).
 */
export function validatePolicy(policy: Policy): string[] | undefined;
/**
 * Returns true if the given rule addresses the supplied operation.
 *
 * @internal
 * @param {PolicyRule} rule - The rule under evaluation.
 * @param {string} operation - The operation name being checked (e.g. 'sendTransaction').
 * @returns {boolean} True if the rule's operation field includes this operation (literal or via wildcard).
 */
export function ruleAddressesOperation(rule: PolicyRule, operation: string): boolean;
export { normalisePolicyWallet };
export type Policy = import("./policy-engine.js").Policy;
export type PolicyEngineOptions = import("./policy-engine.js").PolicyEngineOptions;
export type PolicyRule = import("./policy-engine.js").PolicyRule;
export type RegisterPolicyOptions = import("./policy-engine.js").RegisterPolicyOptions;
import { normalisePolicyWallet } from './policy-schemas.js';
