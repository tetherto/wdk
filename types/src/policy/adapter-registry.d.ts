/**
 * A pure function that reads a method's arguments and produces either a
 * partial `OperationRecord` or an array of partial records for methods that
 * describe multiple sub-operations. Returning `null` signals "I recognize
 * the method but have no canonical mapping"; the engine treats that as an
 * uninterpretable call.
 *
 * The registry attaches `raw` after invocation, so extractors omit it.
 */
export type Extractor = (args: readonly unknown[]) => Omit<OperationRecord, 'raw'> | Omit<OperationRecord, 'raw'>[] | null;
/**
 * A pack of extractors bound to one or more wallet identifiers.
 *
 * `walletTypes` are the identifiers the consumer passed to `registerWallet`.
 * They are opaque, consumer-chosen names, not blockchain identifiers, so an
 * adapter must be told which names it serves.
 */
export type Adapter = {
    /**
     * - Wallet identifiers this adapter serves. Must match the names used with `registerWallet`.
     */
    walletTypes: string[];
    /**
     * - Map of method name to the extractor function for that method.
     */
    extractors: {
        [x: string]: Extractor;
    };
};
/**
 * Identifies one intercepted call for `interpret`.
 */
export type InterpretRequest = {
    /**
     * - Wallet identifier the call was made against.
     */
    walletType: string;
    /**
     * - Method name that was intercepted.
     */
    method: string;
    /**
     * - Arguments passed to the method.
     */
    args: readonly unknown[];
    /**
     * - Read-only view of the account, forwarded onto `raw.account` when supplied.
     */
    account?: OperationRaw['account'];
    /**
     * - The account's derivation path, forwarded onto `raw.path` when supplied.
     */
    path?: string;
    /**
     * - Account index from `wdk.getAccount(wallet, index)`, forwarded onto `raw.index` when supplied.
     */
    index?: number;
};
/**
 * Runtime registry that stores extractor maps keyed by wallet identifier
 * and interprets intercepted method calls into `OperationRecord`s.
 *
 * `register` replaces the whole extractor map for each of the adapter's
 * wallet identifiers. `extend` merges additional extractors into an existing
 * map.
 */
export default class AdapterRegistry {
    /**
     * Registers an adapter for every wallet identifier it names, replacing any
     * extractor map previously registered under those keys. Each key receives
     * its own shallow copy of `extractors`, so a later `extend` on one key does
     * not leak into siblings.
     *
     * @param {Adapter} adapter - The adapter to register.
     * @returns {this} The registry, for chaining.
     * @throws {Error} If `adapter.walletTypes` is empty or contains a blank key.
     */
    register(adapter: Adapter): this;
    /**
     * Merges additional extractors into the map already registered for a
     * wallet identifier. Existing method names are overridden; others are kept.
     *
     * @param {string} walletType - The wallet identifier to extend.
     * @param {Object.<string, Extractor>} extractors - Extractors to add or override.
     * @returns {this} The registry, for chaining.
     * @throws {PolicyAdapterError} If no adapter is registered for `walletType`.
     */
    extend(walletType: string, extractors: {
        [x: string]: Extractor;
    }): this;
    /**
     * Runs the registered extractor for the request's wallet identifier and
     * method and returns the resulting record(s) with `raw` attached. Always
     * returns an array so callers can iterate uniformly.
     *
     * Returns `null` when no adapter is registered for the wallet identifier,
     * when the adapter has no extractor for the method, or when the extractor
     * itself returns `null`. Throws when the extractor throws or returns a
     * record without a string `kind`; engines must treat that as fail-closed.
     *
     * @param {InterpretRequest} request - The intercepted call to interpret.
     * @returns {OperationRecord[] | null} An array of canonical records, or `null` if no interpretation was produced.
     * @throws {PolicyAdapterError} If the extractor throws or produces a malformed record.
     */
    interpret(request: InterpretRequest): OperationRecord[] | null;
    /**
     * Returns the wallet identifiers this registry currently has adapters for,
     * so a misconfigured wallet name can be diagnosed against what is
     * actually registered.
     *
     * @returns {string[]} A snapshot of the registered wallet identifiers.
     */
    walletTypes(): string[];
    private _byWalletType;
}
export type OperationRecord = import("./operation-record.js").OperationRecord;
export type OperationRaw = import("./operation-record.js").OperationRaw;
