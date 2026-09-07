/**
 * Semantic categories for shipped operations. These are the canonical values
 * every shipped adapter emits and every shipped policy understands. Consumers
 * are free to invent additional kinds for their own workflows; shipped
 * policies simply ignore records whose kind they don't recognize.
 */
export type CanonicalOperationKind = 'spend' | 'sign' | 'sign-tx' | 'approve' | 'authorize' | 'swap' | 'batch' | 'other';
/**
 * Pointer back to the original call, for policies that need to inspect
 * caller-specific context beyond the canonical baseline fields.
 */
export type OperationRaw = {
    /**
     * - The wallet identifier the call was made against (the same string passed to `registerWallet`).
     */
    walletType: string;
    /**
     * - The method name that was intercepted.
     */
    method: string;
    /**
     * - The arguments the caller passed, snapshotted at evaluation time.
     */
    args: readonly unknown[];
    /**
     * - A read-only view of the account the call was made on, when the engine supplies it.
     */
    account?: IWalletAccountReadOnly;
    /**
     * - The account's derivation path, when the engine supplies it.
     */
    path?: string;
    /**
     * - The index passed to `wdk.getAccount(wallet, index)`, when the account was retrieved that way.
     */
    index?: number;
};
/**
 * Canonical, adapter-produced description of a single intercepted operation.
 *
 * This shape is a **baseline**, not a lock. Every shipped adapter is
 * guaranteed to populate at least the fields listed below for its operation
 * kind. Adapters may attach any additional fields on top; shipped policies
 * only rely on the baseline, but consumer policies are free to read
 * whatever their paired adapter produces.
 *
 * The `kind` field is typed as `string` on purpose. Consumers with
 * domain-specific operations invent their own kinds and write policies
 * that match on those.
 */
export type OperationRecord = {
    /**
     * - Semantic category. See `CanonicalOperationKind` for the shipped set; consumer-defined values are permitted.
     */
    kind: string;
    /**
     * - Asset identifier: the chain's native symbol sentinel (`ETH`, `BTC`, ...) or a token contract address.
     */
    asset?: string;
    /**
     * - Amount in the asset's smallest base unit. Always non-negative when present; absent when it could not be determined.
     */
    amount?: bigint;
    /**
     * - Recipient address, invoice, delegate contract, or equivalent target of the operation.
     */
    destination?: string;
    /**
     * - For `approve` operations, the address being granted allowance.
     */
    spender?: string;
    /**
     * - For `swap` operations, the asset and amount consumed.
     */
    input?: {
        asset: string;
        amount: bigint;
    };
    /**
     * - For `swap` operations, the asset and amount produced.
     */
    output?: {
        asset: string;
        amount: bigint;
    };
    /**
     * - For `sign` operations, the message or typed-data message being signed.
     */
    message?: string | Uint8Array | Record<string, unknown>;
    /**
     * - For typed-data signatures, the domain separator fields.
     */
    domain?: Record<string, unknown>;
    /**
     * - For typed-data signatures, the type definitions.
     */
    types?: Record<string, unknown>;
    /**
     * - For typed-data signatures, the primary type name when it can be determined.
     */
    primaryType?: string;
    /**
     * - For `sign-tx` operations, the pre-formed transaction being signed.
     */
    tx?: Record<string, unknown>;
    /**
     * - For `batch` operations, the sub-records composing the batch.
     */
    items?: OperationRecord[];
    /**
     * - Original call information for policies needing extra context.
     */
    raw: OperationRaw;
};
export type IWalletAccountReadOnly = import("@tetherto/wdk-wallet").IWalletAccountReadOnly;
