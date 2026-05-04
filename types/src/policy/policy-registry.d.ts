/**
 * @internal
 *
 * In-memory store for registered policies, partitioned into three buckets:
 *   - `_project`     project-scope policies, ordered list, indexed by id.
 *   - `_walletByChain[chain]` wallet-scope policies bound to that chain.
 *   - `_accountByChain[chain]` account-scope policies bound to that chain
 *      (matching against `policy.accounts` paths is done at evaluation time).
 *
 * Same-id-within-same-bucket replaces in place, preserving registration order.
 * Different bindings (same id under chain A vs chain B vs project) are
 * independent records.
 */
export default class PolicyRegistry {
    /** @private */
    private _project;
    /** @private */
    private _walletByChain;
    /** @private */
    private _accountByChain;
    /**
     * Registers a single policy under the given chain bindings.
     * - chains === undefined → project-scope only (policy must be project-scope).
     * - chains is array      → bind under each chain into the matching bucket.
     *
     * @param {object} policy
     * @param {string[] | undefined} chains
     */
    add(policy: object, chains: string[] | undefined): void;
    /**
     * Returns the policies that may apply to a given (chain, path) operation,
     * partitioned into the three groups.
     *
     * @param {string} chain
     * @param {string | undefined} path
     * @returns {{ account: object[], wallet: object[], project: object[] }}
     */
    applicable(chain: string, path: string | undefined): {
        account: object[];
        wallet: object[];
        project: object[];
    };
    /**
     * Returns every policy that's potentially relevant to a given (chain, path),
     * regardless of scope. Used to compute the operation-name set the wrapper
     * needs to handle.
     *
     * @param {string} chain
     * @param {string | undefined} path
     * @returns {object[]}
     */
    relevant(chain: string, path: string | undefined): object[];
    /**
     * Removes wallet- and account-scope policies bound to the given chain.
     * Project-scope policies are left untouched.
     *
     * @param {string} chain
     */
    disposeChain(chain: string): void;
    /**
     * Removes every registered policy across all buckets.
     */
    disposeAll(): void;
}
