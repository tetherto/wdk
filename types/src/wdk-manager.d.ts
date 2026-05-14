/** @typedef {import('@tetherto/wdk-wallet').IWalletAccount} IWalletAccount */
/** @typedef {import('@tetherto/wdk-wallet').FeeRates} FeeRates */
/** @typedef {import('./wallet-account-with-protocols.js').IWalletAccountWithProtocols} IWalletAccountWithProtocols */
/** @typedef {<A extends IWalletAccount>(account: A) => Promise<void>} MiddlewareFunction */
/**
 * @typedef {Object} TraceEvent
 * @property {string} name - The event name (e.g. "wdk.account.resolved").
 * @property {number} startedAt - Epoch milliseconds when the operation started.
 * @property {number} [durationMs] - Elapsed time in milliseconds (omitted for fire-and-forget events).
 * @property {Error} [error] - The error thrown by the operation, if any.
 * @property {string} [blockchain] - The blockchain the event relates to, if any.
 * @property {Record<string, unknown>} [meta] - Additional event-specific metadata.
 */
/** @typedef {(event: TraceEvent) => void} TracerFn */
/**
 * @typedef {Object} WDKConfig
 * @property {TracerFn} [tracer] - Optional observability hook. Called synchronously for every orchestrator operation with a structured event. Defaults to a no-op.
 */
/**
 * Canonical event names emitted by the WDK orchestrator. Use this enum instead
 * of magic strings when filtering or routing in a {@link TracerFn}.
 */
export const TraceEvents: Readonly<{
    Created: "wdk.created";
    WalletRegistered: "wdk.wallet.registered";
    WalletRegisterFailed: "wdk.wallet.register_failed";
    ProtocolRegistered: "wdk.protocol.registered";
    MiddlewareRegistered: "wdk.middleware.registered";
    MiddlewareExecuted: "wdk.middleware.executed";
    MiddlewareFailed: "wdk.middleware.failed";
    AccountResolved: "wdk.account.resolved";
    AccountFailed: "wdk.account.failed";
    FeeRatesResolved: "wdk.fee_rates.resolved";
    FeeRatesFailed: "wdk.fee_rates.failed";
    Disposed: "wdk.disposed";
}>;
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
     * @param {WDKConfig} [config] - Optional WDK configuration.
     * @throws {Error} If the seed is not valid.
     */
    constructor(seed: string | Uint8Array, config?: WDKConfig);
    /** @private */
    private _seed;
    /** @private */
    private _wallets;
    /** @private */
    private _protocols;
    /** @private */
    private _middlewares;
    /** @private */
    private _tracer;
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
    private _runMiddlewares;
    /** @private */
    private _trace;
    /** @private */
    private _registerProtocols;
}
export type IWalletAccount = import("@tetherto/wdk-wallet").IWalletAccount;
export type FeeRates = import("@tetherto/wdk-wallet").FeeRates;
export type IWalletAccountWithProtocols = import("./wallet-account-with-protocols.js").IWalletAccountWithProtocols;
export type MiddlewareFunction = <A extends IWalletAccount>(account: A) => Promise<void>;
export type TraceEvent = {
    /**
     * - The event name (e.g. "wdk.account.resolved").
     */
    name: string;
    /**
     * - Epoch milliseconds when the operation started.
     */
    startedAt: number;
    /**
     * - Elapsed time in milliseconds (omitted for fire-and-forget events).
     */
    durationMs?: number;
    /**
     * - The error thrown by the operation, if any.
     */
    error?: Error;
    /**
     * - The blockchain the event relates to, if any.
     */
    blockchain?: string;
    /**
     * - Additional event-specific metadata.
     */
    meta?: Record<string, unknown>;
};
export type TracerFn = (event: TraceEvent) => void;
export type WDKConfig = {
    /**
     * - Optional observability hook. Called synchronously for every orchestrator operation with a structured event. Defaults to a no-op.
     */
    tracer?: TracerFn;
};
import { SwapProtocol } from '@tetherto/wdk-wallet/protocols';
import { BridgeProtocol } from '@tetherto/wdk-wallet/protocols';
import { LendingProtocol } from '@tetherto/wdk-wallet/protocols';
import { FiatProtocol } from '@tetherto/wdk-wallet/protocols';
