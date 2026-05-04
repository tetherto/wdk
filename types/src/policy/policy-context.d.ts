/** @typedef {import('@tetherto/wdk-wallet').IWalletAccountReadOnly} IWalletAccountReadOnly */
/**
 * Builds the immutable context object passed to every condition function.
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
