/** @typedef {import('./policy-engine.js').Policy} Policy */
/**
 * Policies applicable to a given (wallet, path, index) tuple, partitioned by scope.
 *
 * @typedef {Object} PolicyGroups
 * @property {Policy[]} account - Account-scope policies applicable to the call.
 * @property {Policy[]} project - Project-scope policies applicable to the call.
 */
/**
 * In-memory store for registered policies, partitioned into two buckets:
 *   - `_project`               project-scope policies, ordered list, indexed by id.
 *   - `_accountByWallet`       Map<wallet, ordered list of account-scope policies>
 *                              bound to that wallet identifier (matching against
 *                              `policy.accounts` entries — paths or indexes — is
 *                              done at evaluation time).
 *
 * Same-id-within-same-bucket replaces in place, preserving registration order.
 * Different bindings (same id under wallet A vs wallet B vs project) are
 * independent records.
 *
 * Every stored record carries the condition timeout it was registered with,
 * so the evaluator can race each policy's conditions against its own budget.
 *
 * @internal
 */
export default class PolicyRegistry {
    /** @private */
    private _project;
    /** @private */
    private _accountByWallet;
    /**
     * Registers a single policy under the given wallet bindings.
     * - For a project-scope policy: wallets === undefined applies it globally;
     *   a wallet array narrows the policy to those wallets only.
     * - For an account-scope policy: wallets is required and binds the policy
     *   into the per-wallet account bucket.
     *
     * Stores a defensive deep-ish clone of the policy so callers cannot mutate
     * engine state by editing the original object after registration.
     *
     * @param {Policy} policy - The policy to clone and store.
     * @param {string[] | undefined} wallets - Wallet identifiers the policy binds to. Required for account-scope; undefined for global project-scope.
     * @param {number} conditionTimeoutMs - The effective per-condition timeout, in milliseconds, this policy's conditions are raced against. Already clamped to the engine ceiling by the caller.
     */
    add(policy: Policy, wallets: string[] | undefined, conditionTimeoutMs: number): void;
    /**
     * Returns the policies that may apply to a given (wallet, path, index) call,
     * partitioned into the two groups (account, project). An account-scope
     * policy matches when `policy.accounts` contains the path (string match)
     * or the index (number match). A project-scope policy matches when it
     * has no wallet restriction or its restriction includes the wallet.
     *
     * @param {string} wallet - The wallet identifier the call targets.
     * @param {string | undefined} path - Derivation path of the account, when known.
     * @param {number | undefined} index - Account index, when known.
     * @returns {PolicyGroups} The applicable policies partitioned by scope.
     */
    applicable(wallet: string, path: string | undefined, index: number | undefined): PolicyGroups;
    /**
     * Returns every policy that's potentially relevant to a given (wallet, path, index),
     * regardless of scope. Used to compute the operation-name set the wrapper
     * needs to handle.
     *
     * @param {string} wallet - The wallet identifier the call targets.
     * @param {string | undefined} path - Derivation path of the account, when known.
     * @param {number | undefined} index - Account index, when known.
     * @returns {Policy[]} All applicable policies flattened across scopes.
     */
    relevant(wallet: string, path: string | undefined, index: number | undefined): Policy[];
    /**
     * Removes every binding of this wallet from the registry:
     * - account-scope policies bound to the wallet are dropped entirely.
     * - project-scope policies that included this wallet in their restriction
     *   are narrowed to the remaining wallets; if no wallets are left, the
     *   policy is removed entirely.
     * - global (unrestricted) project-scope policies are untouched.
     *
     * @param {string} wallet - The wallet identifier being disposed.
     */
    disposeWallet(wallet: string): void;
    /**
     * Removes every registered policy across both buckets.
     */
    disposeAll(): void;
}
export type Policy = import("./policy-engine.js").Policy;
/**
 * Policies applicable to a given (wallet, path, index) tuple, partitioned by scope.
 */
export type PolicyGroups = {
    /**
     * - Account-scope policies applicable to the call.
     */
    account: Policy[];
    /**
     * - Project-scope policies applicable to the call.
     */
    project: Policy[];
};
