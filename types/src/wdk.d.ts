export default class WDK {
    /**
     * Returns a random BIP-39 seed phrase.
     *
     * @param {12 | 24} [wordCount] - The number of words to include in the seed phrase (default: 12).
     * @returns {string} The seed phrase.
     */
    static getRandomSeedPhrase(wordCount?: 12 | 24): string;
    /**
     * Checks if a seed is valid.
     *
     * @param {string | Uint8Array} seed - The seed.
     * @returns {boolean} True if the seed is valid.
     */
    static isValidSeed(seed: string | Uint8Array): boolean;
    /**
     * Creates a new WDK.
     *
     * @param {string | Uint8Array} seed - The wallet's BIP-39 seed phrase.
     * @param {WdkOptions} [options] - Instance-level settings such as `maxConditionTimeoutMs`.
     * @throws {Error} If the seed is not valid.
     * @throws {PolicyConfigurationError} If `options` is not a plain object or `maxConditionTimeoutMs` is not a finite positive number.
     */
    constructor(seed: string | Uint8Array, options?: WdkOptions);
    /** @private */
    private _seed;
    /** @private */
    private _wallets;
    /** @private */
    private _protocols;
    /** @private */
    private _middlewares;
    /** @private */
    private _policyEngine;
    /** @private */
    private _decoratedAccounts;
    /**
     * Registers a new wallet to the WDK.
     *
     * @template {typeof WalletManager} W
     * @param {string} blockchain - The name of the blockchain the wallet must be bound to. Can be any string (e.g., "ethereum").
     * @param {W} WalletManager - The wallet manager class.
     * @param {ConstructorParameters<W>[1]} config - The configuration object.
     * @returns {WDK} The WDK.
     * @throws {Error} If a wallet is already registered for the given blockchain.
     */
    registerWallet<W extends typeof WalletManager>(blockchain: string, WalletManager: W, config: ConstructorParameters<W>[1]): WDK;
    /**
     * Registers a new protocol to the WDK.
     *
     * The label must be unique in the scope of the blockchain and the type of protocol (i.e., there can't be two protocols of the
     * same type bound to the same blockchain with the same label).
     *
     * @see {@link IWalletAccountWithProtocols#registerProtocol} to register protocols only for specific accounts.
     * @template {typeof SwapProtocol | typeof BridgeProtocol | typeof LendingProtocol | typeof FiatProtocol | typeof SwidgeProtocol | typeof SdaProtocol} P
     * @param {string} blockchain - The name of the blockchain the protocol must be bound to. Can be any string (e.g., "ethereum").
     * @param {string} label - The label.
     * @param {P} Protocol - The protocol class.
     * @param {ConstructorParameters<P>[1]} config - The protocol configuration.
     * @returns {WDK} The WDK.
     */
    registerProtocol<P extends typeof SwapProtocol | typeof BridgeProtocol | typeof LendingProtocol | typeof FiatProtocol | typeof SwidgeProtocol | typeof SdaProtocol>(blockchain: string, label: string, Protocol: P, config: ConstructorParameters<P>[1]): WDK;
    /**
     * Registers a new middleware to the WDK.
     *
     * It's possible to register multiple middlewares for the same blockchain, which will be called sequentially.
     *
     * @param {string} blockchain - The name of the blockchain the middleware must be bound to. Can be any string (e.g., "ethereum").
     * @param {MiddlewareFunction} middleware - A callback function that is called each time the user derives a new account.
     * @returns {WDK} The WDK.
     */
    registerMiddleware(blockchain: string, middleware: MiddlewareFunction): WDK;
    /**
     * Registers one or more transaction policies that will be evaluated before
     * any wrapped account or protocol method is allowed to execute.
     *
     * Each policy's `wallet` field (optional for `scope: 'project'`, required
     * for `scope: 'account'`) declares which wallet identifier(s) it binds to.
     * A wallet identifier is the same string passed to `registerWallet` — it
     * might be a chain name like `"ethereum"`, but it could equally be
     * `"treasury-cold"` or any label the consumer chose. Omitting `wallet` on
     * a project-scope policy applies it across every registered wallet.
     *
     * Multiple `registerPolicy` calls stack. If a policy with the same id is
     * registered twice into the same binding, the second call replaces the first.
     *
     * @param {Policy | Policy[]} policies - A single policy or array of policies to register on this WDK instance.
     * @param {RegisterPolicyOptions} [options] - Settings applied to the policies this call registers, such as `conditionTimeoutMs`. They do not affect policies registered by other calls.
     * @returns {WDK} The same WDK instance, for chaining.
     * @throws {PolicyConfigurationError} If any policy or option fails validation, or a policy binds to a wallet identifier not previously passed to `registerWallet`.
     */
    registerPolicy(policies: Policy | Policy[], options?: RegisterPolicyOptions): WDK;
    /**
     * Returns the wallet account for a specific blockchain and index (see BIP-44).
     *
     * @param {string} blockchain - The name of the blockchain (e.g., "ethereum").
     * @param {number} [index] - The index of the account to get (default: 0).
     * @returns {Promise<WdkAccount>} The account. When at least one registered policy targets this account, the returned object is a Proxy that throws `PolicyViolationError` from any wrapped write method whose policy evaluation yields a DENY.
     * @throws {Error} If no wallet has been registered for the given blockchain.
     * @throws {PolicyConfigurationError} If a registered policy applies but the underlying wallet account does not implement `toReadOnlyAccount()`.
     */
    getAccount(blockchain: string, index?: number): Promise<WdkAccount>;
    /**
     * Returns the wallet account for a specific blockchain and BIP-44 derivation path.
     *
     * @param {string} blockchain - The name of the blockchain (e.g., "ethereum").
     * @param {string} path - The derivation path (e.g., "0'/0/0").
     * @returns {Promise<WdkAccount>} The account. When at least one registered policy targets this account, the returned object is a Proxy that throws `PolicyViolationError` from any wrapped write method whose policy evaluation yields a DENY.
     * @throws {Error} If no wallet has been registered for the given blockchain.
     * @throws {PolicyConfigurationError} If a registered policy applies but the underlying wallet account does not implement `toReadOnlyAccount()`.
     */
    getAccountByPath(blockchain: string, path: string): Promise<WdkAccount>;
    /**
     * Returns the current fee rates for a specific blockchain.
     *
     * @param {string} blockchain - The name of the blockchain (e.g., "ethereum").
     * @returns {Promise<FeeRates>} The fee rates (in base unit).
     * @throws {Error} If no wallet has been registered for the given blockchain.
     */
    getFeeRates(blockchain: string): Promise<FeeRates>;
    /**
     * Disposes and unregisters wallets, erasing any sensitive data from memory.
     * If no blockchains are specified, all registered wallets are disposed.
     * @param {string[]} [blockchains] - The blockchains to dispose. If omitted, all wallets are disposed.
     */
    dispose(blockchains?: string[]): void;
    /** @private */
    private _applyPolicies;
    /** @private */
    private _runMiddlewares;
    /** @private */
    private _registerProtocols;
}
export type IWalletAccount = import("@tetherto/wdk-wallet").IWalletAccount;
export type FeeRates = import("@tetherto/wdk-wallet").FeeRates;
export type IWalletAccountWithProtocols = import("./wallet-account-with-protocols.js").IWalletAccountWithProtocols;
/**
 * The shape returned by `getAccount` / `getAccountByPath`: the underlying
 * IWalletAccount (sendTransaction, signTransaction, transfer, approve,
 * sign, …) plus the protocol-getter surface added by the WDK at account
 * retrieval time. Concrete wallet packages may further extend this shape.
 */
export type WdkAccount = IWalletAccount & IWalletAccountWithProtocols;
export type MiddlewareFunction = <A extends IWalletAccount>(account: A) => Promise<void>;
export type Policy = import("./policy/policy-engine.js").Policy;
export type PolicyRule = import("./policy/policy-engine.js").PolicyRule;
export type PolicyCondition = import("./policy/policy-engine.js").PolicyCondition;
export type PolicyContext = import("./policy/policy-engine.js").PolicyContext;
export type PolicyAction = import("./policy/policy-engine.js").PolicyAction;
export type PolicyScope = import("./policy/policy-engine.js").PolicyScope;
export type PolicyOperation = import("./policy/policy-engine.js").PolicyOperation;
export type SimulationResult = import("./policy/policy-engine.js").SimulationResult;
export type RegisterPolicyOptions = import("./policy/policy-engine.js").RegisterPolicyOptions;
/**
 * Instance-level settings for a WDK.
 */
export type WdkOptions = {
    /**
     * - Upper bound, in milliseconds, on the per-condition timeout any single policy can be given through `registerPolicy`. Defaults to 30000. A policy registered with a larger `conditionTimeoutMs` is capped to this value rather than rejected.
     */
    maxConditionTimeoutMs?: number;
};
import WalletManager from '@tetherto/wdk-wallet';
import { SwapProtocol } from '@tetherto/wdk-wallet/protocols';
import { BridgeProtocol } from '@tetherto/wdk-wallet/protocols';
import { LendingProtocol } from '@tetherto/wdk-wallet/protocols';
import { FiatProtocol } from '@tetherto/wdk-wallet/protocols';
import { SwidgeProtocol } from '@tetherto/wdk-wallet/protocols';
import { SdaProtocol } from '@tetherto/wdk-wallet/protocols';
