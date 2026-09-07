/**
 * Returns a Proxy that exposes policy-enforced versions of write methods on
 * the given account. The policy engine itself does not mutate the account
 * (the WDK's `_registerProtocols` step does install
 * `registerProtocol` / `getXProtocol` helpers on the account before the
 * proxy is built — that's a separate, pre-existing concern).
 *
 * Nested-call escape falls out naturally from how the Proxy works rather
 * than from any kind of async-context tracking:
 *
 * - When a user calls a write method via the proxy, the proxy's `get` trap
 *   returns the enforced wrapper. The wrapper evaluates policies, then
 *   invokes the original method (bound to the underlying account, not the
 *   proxy).
 * - Inside the original method, `this.someOtherMethod()` resolves on the
 *   underlying account — bypassing the proxy entirely. SDK code that holds
 *   a direct reference to the underlying account (which is how protocol
 *   packages are constructed) is also unaffected.
 * - Only access through the proxy goes through policy evaluation.
 *
 * This works identically on every JavaScript runtime that supports `Proxy`
 * (i.e. all of them). No async context, no Promise patching, no
 * runtime-specific code paths.
 *
 * If no policy applies to the (wallet, path, index) tuple, the function
 * returns the original account unchanged.
 *
 * @internal
 * @param {IWalletAccount} account - The underlying account from the wallet manager.
 * @param {WrapContext} options - The per-account routing context (wallet identifier, path/index, and the engine reference).
 * @returns {Promise<IWalletAccount>} The proxy-wrapped account, or the original if no policy applies.
 * @throws {PolicyConfigurationError} If at least one policy applies but the underlying account does not implement `toReadOnlyAccount()`.
 */
export function createPolicyEnforcedAccount(account: IWalletAccount, { blockchain, path, index, engine }: WrapContext): Promise<IWalletAccount>;
/**
 * The per-account state every enforced method closes over. Built once per
 * `createPolicyEnforcedAccount` call and shared by all of that account's
 * wrapped methods.
 */
export type EnforcementContext = {
    /**
     * - The raw account, read for its derivation path when resolving account-scope bindings.
     */
    account: IWalletAccount;
    /**
     * - The read-only view handed to condition functions as `context.account`.
     */
    readOnlyAccount: IWalletAccountReadOnly;
    /**
     * - The wallet identifier (the same string passed to `registerWallet`).
     */
    blockchain: string;
    /**
     * - The index passed to `wdk.getAccount(wallet, index)`, when the account was retrieved that way.
     */
    index: number | undefined;
    /**
     * - The engine that evaluates each intercepted call.
     */
    engine: PolicyEngine;
};
export type IWalletAccount = import("@tetherto/wdk-wallet").IWalletAccount;
export type IWalletAccountReadOnly = import("@tetherto/wdk-wallet").IWalletAccountReadOnly;
export type PolicyEngine = import("./policy-engine.js").default;
export type WrapContext = import("./policy-engine.js").WrapContext;
