/**
 * Wraps every write method on the given account that's referenced by a
 * registered policy, plus the four protocol getters so protocols returned
 * by them have their write methods wrapped too. Also attaches an
 * `account.simulate.*` mirror that runs evaluation without execution.
 *
 * If no registered policy applies to (chain, path), this is a no-op.
 *
 * @internal
 * @param {IWalletAccount} account - The runtime account instance to mutate.
 * @param {object} options
 * @param {string} options.blockchain
 * @param {string | undefined} options.path
 * @param {object} options.engine - The PolicyEngine instance.
 */
export function applyPoliciesToAccount(account: IWalletAccount, { blockchain, path, engine }: {
    blockchain: string;
    path: string | undefined;
    engine: object;
}): Promise<void>;
export type IWalletAccount = import("@tetherto/wdk-wallet").IWalletAccount;
