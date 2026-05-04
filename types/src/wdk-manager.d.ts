/** @typedef {import('@tetherto/wdk-wallet').IWalletAccount} IWalletAccount */
/** @typedef {import('@tetherto/wdk-wallet').FeeRates} FeeRates */
/** @typedef {import('./wallet-account-with-protocols.js').IWalletAccountWithProtocols} IWalletAccountWithProtocols */
/** @typedef {<A extends IWalletAccount>(account: A) => Promise<void>} MiddlewareFunction */
/** @typedef {import('./policy/policy-engine.js').Policy} Policy */
/** @typedef {import('./policy/policy-engine.js').PolicyRule} PolicyRule */
/** @typedef {import('./policy/policy-engine.js').PolicyCondition} PolicyCondition */
/** @typedef {import('./policy/policy-engine.js').PolicyContext} PolicyContext */
/** @typedef {import('./policy/policy-engine.js').PolicyAction} PolicyAction */
/** @typedef {import('./policy/policy-engine.js').PolicyScope} PolicyScope */
/** @typedef {import('./policy/policy-engine.js').PolicyOperation} PolicyOperation */
/** @typedef {import('./policy/policy-engine.js').SimulationResult} SimulationResult */
/** @typedef {import('./policy/policy-engine.js').RegisterPolicyOptions} RegisterPolicyOptions */
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
     * Creates a new wallet development kit instance.
     *
     * @param {string | Uint8Array} seed - The wallet's BIP-39 seed phrase.
     * @throws {Error} If the seed is not valid.
     */
    constructor(seed: string | Uint8Array);
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
    /**
     * Registers a new wallet to WDK.
     *
     * @template {typeof WalletManager} W
     * @param {string} blockchain - The name of the blockchain the wallet must be bound to. Can be any string (e.g., "ethereum").
     * @param {W} WalletManager - The wallet manager class.
     * @param {ConstructorParameters<W>[1]} config - The configuration object.
     * @returns {WDK} The wdk instance.
     */
    registerWallet<W extends typeof import("@tetherto/wdk-wallet").default>(blockchain: string, WalletManager: W, config: ConstructorParameters<W>[1]): WDK;
    /**
     * Registers a new protocol to WDK.
     *
     * The label must be unique in the scope of the blockchain and the type of protocol (i.e., there can't be two protocols of the
     * same type bound to the same blockchain with the same label).
     *
     * @see {@link IWalletAccountWithProtocols#registerProtocol} to register protocols only for specific accounts.
     * @template {typeof SwapProtocol | typeof BridgeProtocol | typeof LendingProtocol | typeof FiatProtocol} P
     * @param {string} blockchain - The name of the blockchain the protocol must be bound to. Can be any string (e.g., "ethereum").
     * @param {string} label - The label.
     * @param {P} Protocol - The protocol class.
     * @param {ConstructorParameters<P>[1]} config - The protocol configuration.
     * @returns {WDK} The wdk instance.
     */
    registerProtocol<P extends typeof SwapProtocol | typeof BridgeProtocol | typeof LendingProtocol | typeof FiatProtocol>(blockchain: string, label: string, Protocol: P, config: ConstructorParameters<P>[1]): WDK;
    /**
     * Registers a new middleware to WDK.
     *
     * It's possible to register multiple middlewares for the same blockchain, which will be called sequentially.
     *
     * @param {string} blockchain - The name of the blockchain the middleware must be bound to. Can be any string (e.g., "ethereum").
     * @param {MiddlewareFunction} middleware - A callback function that is called each time the user derives a new account.
     * @returns {WDK} The wdk instance.
     */
    registerMiddleware(blockchain: string, middleware: MiddlewareFunction): WDK;
    /**
     * Registers one or more transaction policies that will be evaluated before
     * any wrapped account or protocol method is allowed to execute.
     *
     * The first argument may be a chain name (string), a list of chain names
     * (string[]), or omitted entirely. When omitted, the policies are project-
     * scoped only — applicable across every registered wallet. When provided,
     * wallet- and account-scope policies are bound to those specific chains.
     *
     * Multiple `registerPolicy` calls stack. If a policy with the same id is
     * registered twice into the same chain binding, the second call replaces
     * the first.
     *
     * @overload
     * @param {Policy | Policy[]} policies
     * @param {RegisterPolicyOptions} [options]
     * @returns {WDK}
     */
    registerPolicy(policies: Policy | Policy[], options?: RegisterPolicyOptions): WDK;
    /**
     * @overload
     * @param {string | string[]} chain
     * @param {Policy | Policy[]} policies
     * @param {RegisterPolicyOptions} [options]
     * @returns {WDK}
     */
    registerPolicy(chain: string | string[], policies: Policy | Policy[], options?: RegisterPolicyOptions): WDK;
    /**
     * Returns the wallet account for a specific blockchain and index (see BIP-44).
     *
     * @param {string} blockchain - The name of the blockchain (e.g., "ethereum").
     * @param {number} [index] - The index of the account to get (default: 0).
     * @returns {Promise<IWalletAccountWithProtocols>} The account.
     * @throws {Error} If no wallet has been registered for the given blockchain.
     */
    getAccount(blockchain: string, index?: number): Promise<IWalletAccountWithProtocols>;
    /**
     * Returns the wallet account for a specific blockchain and BIP-44 derivation path.
     *
     * @param {string} blockchain - The name of the blockchain (e.g., "ethereum").
     * @param {string} path - The derivation path (e.g., "0'/0/0").
     * @returns {Promise<IWalletAccountWithProtocols>} The account.
     * @throws {Error} If no wallet has been registered for the given blockchain.
     */
    getAccountByPath(blockchain: string, path: string): Promise<IWalletAccountWithProtocols>;
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
import { SwapProtocol } from '@tetherto/wdk-wallet/protocols';
import { BridgeProtocol } from '@tetherto/wdk-wallet/protocols';
import { LendingProtocol } from '@tetherto/wdk-wallet/protocols';
import { FiatProtocol } from '@tetherto/wdk-wallet/protocols';
