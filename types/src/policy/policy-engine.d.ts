/**
 * The orchestration façade. Owns the registry; exposes the two methods the
 * `WDK` class calls (`register`, `applyPoliciesTo`). Internal helpers
 * (`_isGoverned`, `_evaluateContext`, `_simulateContext`) are used by the
 * wrapper module.
 *
 * Each registered policy carries the condition timeout it was registered
 * with; the engine only owns the ceiling that timeout is clamped to.
 *
 * @internal
 */
export default class PolicyEngine {
    /**
     * @param {PolicyEngineOptions} [options] - Engine-level settings such as `maxConditionTimeoutMs`.
     * @throws {PolicyConfigurationError} If `options` is not a plain object or `maxConditionTimeoutMs` is not a finite positive number.
     */
    constructor(options?: PolicyEngineOptions);
    /** @private */
    private _registry;
    /** @private */
    private _maxConditionTimeoutMs;
    /**
     * Registers one or more policies. Synchronously throws on validation failures.
     * Validation runs to completion before any registry mutation, so a failure
     * never leaves the engine partially mutated.
     *
     * @param {Policy | Policy[]} policies - A single policy or array of policies to register.
     * @param {RegisterPolicyOptions} [options] - Settings applied to the policies this call registers, such as `conditionTimeoutMs`.
     * @param {RegistrationContext} [registrationContext] - Optional set of registered wallet identifiers. When provided, the engine verifies every wallet binding referenced by the policies is in the set before touching the registry.
     * @throws {PolicyConfigurationError} If any policy or option fails schema validation, the input is an empty array, or a policy binds to a wallet not present in `registrationContext.knownWallets`.
     */
    register(policies: Policy | Policy[], options?: RegisterPolicyOptions, registrationContext?: RegistrationContext): void;
    /**
     * Returns a policy-enforced view of the given account — a Proxy that
     * exposes enforced versions of write methods. The original account is
     * never mutated. If no policy applies, returns the original account.
     *
     * @param {IWalletAccount} account - The raw account from the wallet manager. Mutated only by the WDK's `_registerProtocols` step (which runs before this method), not by the policy engine.
     * @param {Omit<WrapContext, 'engine'>} ctx - The per-account routing context. The engine reference is supplied by `this`.
     * @returns {Promise<IWalletAccount>} The enforced proxy, or the original account if no policy applies.
     * @throws {PolicyConfigurationError} If at least one policy applies but the underlying account does not implement `toReadOnlyAccount()`.
     */
    applyPoliciesTo(account: IWalletAccount, { blockchain, path, index }: Omit<WrapContext, "engine">): Promise<IWalletAccount>;
    /**
     * Removes account-scope and wallet-bound project policies registered under
     * the given wallet identifier.
     *
     * @param {string} wallet - The wallet identifier to dispose.
     */
    disposeWallet(wallet: string): void;
    /**
     * Removes all registered policies across every bucket.
     */
    disposeAll(): void;
    /** @private */
    private _isGoverned;
    /** @private */
    private _evaluateContext;
    /** @private */
    private _simulateContext;
}
export type IWalletAccount = import("@tetherto/wdk-wallet").IWalletAccount;
export type IWalletAccountReadOnly = import("@tetherto/wdk-wallet").IWalletAccountReadOnly;
/**
 * The verdict a matching rule produces: either permit the operation or block it.
 */
export type PolicyAction = "ALLOW" | "DENY";
/**
 * The scope a policy binds to: globally / per-wallet (`project`) or per-account (`account`).
 */
export type PolicyScope = "project" | "account";
/**
 * A wrapped operation name from the supported set, or `*` to match any wrapped operation.
 * Each name must match an actual method on `IWalletAccount` or a registered protocol.
 */
export type PolicyOperation = "sendTransaction" | "signTransaction" | "transfer" | "approve" | "sign" | "signTypedData" | "signAuthorization" | "delegate" | "revokeDelegation" | "swap" | "bridge" | "supply" | "withdraw" | "borrow" | "repay" | "buy" | "sell" | "swidge" | "createDepositAddress" | "renewDepositAddress" | "recoverDepositAddress" | "disableDepositAddress" | "*";
/**
 * The frozen context object passed to every condition function during evaluation.
 */
export type PolicyContext = {
    /**
     * - The intercepted operation name.
     */
    operation: PolicyOperation;
    /**
     * - The wallet identifier (the same string passed to `wdk.registerWallet`). Despite the name, this is an opaque key chosen by the consumer — it might be a chain name like `"ethereum"`, but it could equally be `"treasury-cold"` or any other label.
     */
    wallet: string;
    /**
     * - A read-only view of the wallet account.
     */
    account: IWalletAccountReadOnly;
    /**
     * - The full argument array the wrapped method was called with, snapshotted at evaluation time. `args[0]` is the first argument; every element is readable, so multi-argument operations (e.g. `swidge(options, config)`) can be gated on any of them.
     */
    args: readonly unknown[];
};
/**
 * A user-supplied predicate that receives the call context and returns
 * (or resolves to) a truthy/falsy verdict. Throwing or timing out is
 * treated per the rule's fail mode (fail-closed for DENY, fail-open-as-no-match for ALLOW).
 */
export type PolicyCondition = (context: PolicyContext) => boolean | Promise<boolean>;
/**
 * A single ALLOW/DENY decision within a policy, evaluated for one or more
 * operations gated by a list of conditions.
 */
export type PolicyRule = {
    /**
     * - Stable identifier for the rule within its policy. Surfaces on PolicyViolationError.ruleName and in simulation traces.
     */
    name: string;
    /**
     * - Optional human-readable explanation. When set on a DENY rule that matches, propagates to PolicyViolationError.reason and to the matching simulate-result. Defaults to the rule's name.
     */
    reason?: string;
    /**
     * - The wrapped operation(s) this rule addresses. May be a single operation name, an array, or the wildcard `*`.
     */
    operation: PolicyOperation | PolicyOperation[];
    /**
     * - Whether a matching rule allows or denies the operation.
     */
    action: PolicyAction;
    /**
     * - When true on an account-scope ALLOW rule that matches, the rule's verdict short-circuits project-scope evaluation. Account-scope rules are evaluated in registration order; the first matching override-flag rule wins. Only valid on account-scope ALLOW rules.
     */
    override_broader_scope?: boolean;
    /**
     * - Functions evaluated in order; all must return truthy for the rule to match. Each is raced against the `conditionTimeoutMs` its own policy was registered with.
     */
    conditions: PolicyCondition[];
    /**
     * - Reserved for future use; currently ignored at runtime.
     */
    state?: Record<string, unknown>;
    /**
     * - Reserved for future use; currently ignored at runtime.
     */
    onSuccess?: (c: PolicyContext) => void | Promise<void>;
};
/**
 * Identifies an account targeted by an account-scope policy: either a derivation
 * path (string, exact match against `account.path`) or a non-negative integer
 * index (matched against the index passed to `wdk.getAccount(wallet, index)`).
 */
export type AccountIdentifier = string | number;
/**
 * A user-supplied policy: identifies itself, optionally binds to one or more
 * wallets/accounts, and carries an ordered list of rules.
 */
export type Policy = {
    /**
     * - Unique identifier within an engine. Re-registering the same id replaces the prior policy in the same wallet bucket.
     */
    id: string;
    /**
     * - Human-readable label.
     */
    name: string;
    /**
     * - Whether the policy applies to all accounts on the wallet(s) (`project`) or a specific subset (`account`).
     */
    scope: PolicyScope;
    /**
     * - The wallet identifier(s) this policy binds to. Each entry must match a string previously passed to `wdk.registerWallet`. For `scope: 'project'`, omitting `wallet` applies the policy across every registered wallet; providing one or more narrows it to those wallets. For `scope: 'account'`, `wallet` is required.
     */
    wallet?: string | string[];
    /**
     * - The accounts this policy applies to (required when scope is 'account'). Each entry is either a derivation path (exact-string match against `account.path`) or a non-negative integer (match against the index passed to `wdk.getAccount(wallet, index)`). Index entries do not match accounts retrieved via `getAccountByPath` — use derivation paths if you need both retrieval styles to work.
     */
    accounts?: AccountIdentifier[];
    /**
     * - Ordered list of rules. Evaluation is rule-by-rule within a policy; DENY wins over ALLOW within the same scope.
     */
    rules: PolicyRule[];
};
/**
 * Settings supplied to `registerPolicy`, scoped to the policies that call
 * registers. Other policies are unaffected.
 */
export type RegisterPolicyOptions = {
    /**
     * - Reserved for future use; currently ignored at runtime.
     */
    state?: Record<string, unknown>;
    /**
     * - Per-condition evaluation timeout in milliseconds, applied to every policy this call registers. Defaults to 30000. Values above the engine's `maxConditionTimeoutMs` ceiling are capped to that ceiling. A condition that exceeds the timeout is treated the same as a throw — fail-closed for DENY rules, fail-open-as-no-match for ALLOW rules.
     */
    conditionTimeoutMs?: number;
};
/**
 * Settings supplied to the `PolicyEngine` constructor.
 */
export type PolicyEngineOptions = {
    /**
     * - Upper bound, in milliseconds, on the per-condition timeout any single policy can be given. Defaults to 30000. A policy registered with a larger `conditionTimeoutMs` is capped to this value rather than rejected.
     */
    maxConditionTimeoutMs?: number;
};
/**
 * One row in a simulation trace: the rule that was evaluated, its scope,
 * and whether all conditions matched.
 */
export type SimulationTraceEntry = {
    /**
     * - The scope of the policy that emitted this trace entry.
     */
    scope: PolicyScope;
    /**
     * - The id of the policy whose rule was evaluated.
     */
    policy_id: string;
    /**
     * - The name of the rule that was evaluated.
     */
    rule_name: string;
    /**
     * - True if every condition on the rule returned truthy (and didn't throw or time out).
     */
    matched: boolean;
    /**
     * - Set when a condition threw or timed out; carries the error message.
     */
    error?: string;
};
/**
 * The structured verdict returned by `account.simulate.<method>(...)`:
 * decision plus the identifying triple plus a per-rule trace.
 */
export type SimulationResult = {
    /**
     * - The verdict the engine would produce for this context.
     */
    decision: "ALLOW" | "DENY";
    /**
     * - Id of the policy whose rule produced the verdict, or null when no rule addresses the operation (`no-applicable-rule`) or matched (`governed-but-unmatched`).
     */
    policy_id: string | null;
    /**
     * - Name of the matching rule, or null when no rule matched.
     */
    matched_rule: string | null;
    /**
     * - Human-readable explanation: the rule's `reason` field, or one of `matched` / `override` / `no-applicable-rule` / `governed-but-unmatched`.
     */
    reason: string | null;
    /**
     * - Per-rule evaluation outcomes in the order they were considered. Useful for debugging.
     */
    trace: SimulationTraceEntry[];
};
/**
 * The per-account routing context passed from the WDK manager into the
 * policy engine / proxy wrapper. Identifies which wallet + which
 * account-within-the-wallet a wrapped method is being invoked under,
 * and carries the engine reference the proxy will delegate evaluation to.
 */
export type WrapContext = {
    /**
     * - The wallet identifier (the same string passed to `registerWallet`; treated as an opaque key here).
     */
    blockchain: string;
    /**
     * - Derivation path of the account, when known.
     */
    path: string | undefined;
    /**
     * - Index passed to `wdk.getAccount(wallet, index)`, when known. Used to match index-form entries in `policy.accounts`.
     */
    index?: number | undefined;
    /**
     * - The PolicyEngine instance the proxy delegates evaluation to.
     */
    engine: PolicyEngine;
};
/**
 * Optional context passed alongside `register()` so the engine can verify
 * wallet bindings against the host application's registry before mutating
 * its own.
 */
export type RegistrationContext = {
    /**
     * - Set of wallet identifiers the host considers registered. When provided, the engine throws if any policy binds to a wallet not in the set.
     */
    knownWallets?: Set<string>;
};
