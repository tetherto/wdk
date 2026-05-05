/** @typedef {import('@tetherto/wdk-wallet').IWalletAccountReadOnly} IWalletAccountReadOnly */
/**
 * Builds the immutable context object passed to every condition function.
 *
 * Each cloneable argument is passed through structuredClone so condition
 * functions see a snapshot taken at evaluation time. This prevents
 * time-of-check / time-of-use mutation: a caller mutating the original
 * tx object after the wrapper builds the context (e.g., concurrent
 * middleware on a shared request body) cannot change what the conditions
 * already evaluated. The original arguments still flow through to the
 * underlying method untouched. Arguments that aren't structured-cloneable
 * (functions, class instances with non-cloneable internals) fall back to
 * their raw value.
 *
 * @internal
 * @param {object} input
 * @param {string} input.operation - The wrapped operation name (e.g. 'sendTransaction').
 * @param {string} input.chain - The blockchain identifier.
 * @param {IWalletAccountReadOnly} input.account - A read-only view of the wallet account.
 * @param {readonly unknown[]} input.args - The full argument array passed to the method.
 * @returns {object} A frozen context object: { operation, chain, account, params, args }.
 */
export function buildContext({ operation, chain, account, args }: {
    operation: string;
    chain: string;
    account: IWalletAccountReadOnly;
    args: readonly unknown[];
}): object;
export type IWalletAccountReadOnly = import("@tetherto/wdk-wallet").IWalletAccountReadOnly;
