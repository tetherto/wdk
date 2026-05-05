/** @typedef {import('@tetherto/wdk-wallet').IWalletAccountReadOnly} IWalletAccountReadOnly */
/**
 * @typedef {'ALLOW' | 'DENY'} PolicyAction
 */
/**
 * @typedef {'project' | 'wallet' | 'account'} PolicyScope
 */
/**
 * @typedef {'sendTransaction' | 'transfer' | 'approve' | 'signMessage' | 'signHash'
 *   | 'signTypedData' | 'signAuthorization' | 'delegate' | 'revokeDelegation'
 *   | 'swap' | 'bridge' | 'supply' | 'withdraw' | 'borrow' | 'repay' | 'buy' | 'sell'
 *   | '*'} PolicyOperation
 */
/**
 * @typedef {object} PolicyContext
 * @property {PolicyOperation} operation - The intercepted operation name.
 * @property {string} chain - The blockchain identifier.
 * @property {IWalletAccountReadOnly} account - A read-only view of the wallet account.
 * @property {unknown} params - The first argument to the wrapped method.
 * @property {readonly unknown[]} args - The full argument array.
 */
/**
 * @typedef {(context: PolicyContext) => boolean | Promise<boolean>} PolicyCondition
 */
/**
 * @typedef {object} PolicyRule
 * @property {string} name
 * @property {string} [reason] - Optional human-readable explanation. When set on a DENY rule that matches, propagates to PolicyViolationError.reason and to the matching simulate-result. Defaults to the rule's name.
 * @property {PolicyOperation | PolicyOperation[]} operation
 * @property {PolicyAction} action
 * @property {boolean} [override_broader_scope] - When true on an account-scope ALLOW rule that matches, the rule's verdict short-circuits both wallet- and project-scope evaluation. Account-scope rules are evaluated in registration order; the first matching override-flag rule wins. Only valid on account-scope ALLOW rules.
 * @property {PolicyCondition[]} conditions
 * @property {object} [state]                                       Reserved for Phase 2; ignored at runtime.
 * @property {(c: PolicyContext) => void | Promise<void>} [onSuccess]   Reserved for Phase 2; ignored at runtime.
 */
/**
 * @typedef {object} Policy
 * @property {string} id
 * @property {string} name
 * @property {PolicyScope} scope
 * @property {string[]} [accounts] - Derivation paths the policy applies to (required when scope is 'account'). Exact-string matching only in Phase 1; no prefix or wildcard matching.
 * @property {PolicyRule[]} rules
 */
/**
 * @typedef {object} RegisterPolicyOptions
 * @property {object} [state] - Reserved for Phase 2.
 */
/**
 * @typedef {object} SimulationTraceEntry
 * @property {PolicyScope} scope
 * @property {string} policy_id
 * @property {string} rule_name
 * @property {boolean} matched
 * @property {string} [error]
 */
/**
 * @typedef {object} SimulationResult
 * @property {'ALLOW' | 'DENY'} decision
 * @property {string | null} policy_id
 * @property {string | null} matched_rule
 * @property {string | null} reason
 * @property {SimulationTraceEntry[]} trace
 */
/**
 * @internal
 *
 * The orchestration façade. Owns the registry; exposes the two methods the
 * `WDK` class calls (`register`, `applyPoliciesTo`). Internal helpers
 * (`_relevantOperations`, `_evaluateContext`, `_simulateContext`) are used
 * by the wrapper module.
 */
export default class PolicyEngine {
    /** @private */
    private _registry;
    /**
     * Registers one or more policies. Synchronously throws on validation failures.
     *
     * @param {string | string[] | undefined} chain
     * @param {Policy | Policy[]} policies
     * @param {RegisterPolicyOptions} [options]
     */
    register(chain: string | string[] | undefined, policies: Policy | Policy[], options?: RegisterPolicyOptions): void;
    /**
     * Wraps the given account with policy enforcement.
     *
     * @param {object} account
     * @param {object} ctx
     * @param {string} ctx.blockchain
     * @param {string | undefined} ctx.path
     */
    applyPoliciesTo(account: object, { blockchain, path }: {
        blockchain: string;
        path: string | undefined;
    }): Promise<void>;
    /**
     * Removes wallet- and account-bound policies for the given chain.
     *
     * @param {string} chain
     */
    disposeChain(chain: string): void;
    /**
     * Removes all registered policies across every bucket.
     */
    disposeAll(): void;
    /** @private */
    private _relevantOperations;
    /** @private */
    private _evaluateContext;
    /** @private */
    private _simulateContext;
}
export type IWalletAccountReadOnly = import("@tetherto/wdk-wallet").IWalletAccountReadOnly;
export type PolicyAction = "ALLOW" | "DENY";
export type PolicyScope = "project" | "wallet" | "account";
export type PolicyOperation = "sendTransaction" | "transfer" | "approve" | "signMessage" | "signHash" | "signTypedData" | "signAuthorization" | "delegate" | "revokeDelegation" | "swap" | "bridge" | "supply" | "withdraw" | "borrow" | "repay" | "buy" | "sell" | "*";
export type PolicyContext = {
    /**
     * - The intercepted operation name.
     */
    operation: PolicyOperation;
    /**
     * - The blockchain identifier.
     */
    chain: string;
    /**
     * - A read-only view of the wallet account.
     */
    account: IWalletAccountReadOnly;
    /**
     * - The first argument to the wrapped method.
     */
    params: unknown;
    /**
     * - The full argument array.
     */
    args: readonly unknown[];
};
export type PolicyCondition = (context: PolicyContext) => boolean | Promise<boolean>;
export type PolicyRule = {
    name: string;
    /**
     * - Optional human-readable explanation. When set on a DENY rule that matches, propagates to PolicyViolationError.reason and to the matching simulate-result. Defaults to the rule's name.
     */
    reason?: string;
    operation: PolicyOperation | PolicyOperation[];
    action: PolicyAction;
    /**
     * - When true on an account-scope ALLOW rule that matches, the rule's verdict short-circuits both wallet- and project-scope evaluation. Account-scope rules are evaluated in registration order; the first matching override-flag rule wins. Only valid on account-scope ALLOW rules.
     */
    override_broader_scope?: boolean;
    conditions: PolicyCondition[];
    /**
     * Reserved for Phase 2; ignored at runtime.
     */
    state?: object;
    /**
     * Reserved for Phase 2; ignored at runtime.
     */
    onSuccess?: (c: PolicyContext) => void | Promise<void>;
};
export type Policy = {
    id: string;
    name: string;
    scope: PolicyScope;
    /**
     * - Derivation paths the policy applies to (required when scope is 'account'). Exact-string matching only in Phase 1; no prefix or wildcard matching.
     */
    accounts?: string[];
    rules: PolicyRule[];
};
export type RegisterPolicyOptions = {
    /**
     * - Reserved for Phase 2.
     */
    state?: object;
};
export type SimulationTraceEntry = {
    scope: PolicyScope;
    policy_id: string;
    rule_name: string;
    matched: boolean;
    error?: string;
};
export type SimulationResult = {
    decision: "ALLOW" | "DENY";
    policy_id: string | null;
    matched_rule: string | null;
    reason: string | null;
    trace: SimulationTraceEntry[];
};
