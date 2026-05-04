/**
 * The complete set of write-facing operations the policy engine wraps in Phase 1.
 * The wildcard `*` matches any of them.
 *
 * @internal
 */
export const OPERATIONS: readonly string[];
/** @internal */
export const OPERATIONS_SET: Set<string>;
/** @internal */
export const WILDCARD: "*";
/** @internal */
export const SCOPES: readonly string[];
/** @internal */
export const ACTIONS: readonly string[];
/**
 * Maps each protocol type to the methods on its instances that the engine wraps.
 * Quote variants are intentionally absent.
 *
 * @internal
 */
export const PROTOCOL_METHODS: Readonly<{
    swap: string[];
    bridge: string[];
    lending: string[];
    fiat: string[];
}>;
/**
 * Symbol used to mark an account as currently inside a wrapped call so that
 * nested wrapped calls (e.g. approve → sendTransaction) skip re-evaluation.
 *
 * @internal
 */
export const POLICY_CTX: unique symbol;
