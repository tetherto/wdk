export default class WdkManager {
    /**
     * Returns a random BIP-39 seed phrase.
     *
     * @returns {string} The seed phrase.
     */
    static getRandomSeedPhrase(): string;
    /**
     * Checks if a seed is valid.
     *
     * @param {string | Uint8Array} seed - The seed.
     * @returns {boolean} True if the seed is valid.
     */
    static isValidSeed(seed: string | Uint8Array): boolean;
    /**
     * Creates a new wallet development kit manager.
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
    /**
     *  @private
     *  @type {Array<Policy>}
     */
    private _policies;
    /**
     * Register one or more wallet policies.
     *
     * Policies gate all mutating wallet methods.
     *
     * @param {Array<Policy>} policies
     * @returns {WdkManager}
     */
    registerPolicies(policies?: Array<Policy>): WdkManager;
    /**
     * Runs policies sequentially.
     *
     * @param {Array<Policy>} policies
     * @param {string} method
     * @param {any} params
     * @param {PolicyTarget} target
     * @private
     */
    private _runPolicies;
    /**
     * Applies policies to a specific account or protocol instance.
     * Policies are isolated per account.
     *
     * @template {typeof SwapProtocol | typeof BridgeProtocol | typeof LendingProtocol | typeof FiatProtocol | IWalletAccountWithProtocols} P
     * @param {P} instance
     * @param {PolicyTarget} target
     * @returns {P}
     * @private
     */
    private _withPolicyGate;
    /**
     * Registers a new wallet to the wdk manager.
     *
     * @template {typeof WalletManager} W
     * @param {string} blockchain - The name of the blockchain the wallet must be bound to. Can be any string (e.g., "ethereum").
     * @param {W} WalletManager - The wallet manager class.
     * @param {ConstructorParameters<W>[1]} config - The configuration object.
     * @returns {WdkManager} The wdk manager.
     */
    registerWallet<W extends typeof WalletManager>(blockchain: string, WalletManager: W, config: ConstructorParameters<W>[1]): WdkManager;
    /**
     * Registers a new protocol to the wdk manager.
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
     * @returns {WdkManager} The wdk manager.
     */
    registerProtocol<P extends typeof SwapProtocol | typeof BridgeProtocol | typeof LendingProtocol | typeof FiatProtocol>(blockchain: string, label: string, Protocol: P, config: ConstructorParameters<P>[1]): WDK;
    /**
     * Registers a new middleware to the wdk manager.
     *
     * It's possible to register multiple middlewares for the same blockchain, which will be called sequentially.
     *
     * @param {string} blockchain - The name of the blockchain the middleware must be bound to. Can be any string (e.g., "ethereum").
     * @param {MiddlewareFunction} middleware - A callback function that is called each time the user derives a new account.
     * @returns {WdkManager} The wdk manager.
     */
    registerMiddleware(blockchain: string, middleware: MiddlewareFunction): WdkManager;
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
     * Disposes and unregisters all the wallets, erasing any sensitive data from the memory.
     */
    dispose(): void;
    /** @private */
    private _runMiddlewares;
    /** @private */
    private _registerProtocols;
}
export type IWalletAccount = import("@tetherto/wdk-wallet").IWalletAccount;
export type FeeRates = import("@tetherto/wdk-wallet").FeeRates;
export type IWalletAccountWithProtocols = import("./wallet-account-with-protocols.js").IWalletAccountWithProtocols;
export type MiddlewareFunction = <A extends IWalletAccount>(account: A) => Promise<void>;
export type PolicyTarget = {
    /**
     * - The account blockchain identifier this policy applies to.
     */
    blockchain?: string;
    /**
     * - The protocol this policy applies to.
     */
    protocol?: {
        blockchain?: string;
        label?: string;
    };
};
export type PolicyEvaluator = (method: string, params: any, wallet: any) => boolean | Promise<boolean>;
export type Policy = {
    /**
     * - The policy name.
     */
    name: string;
    /**
     * - Scopes the policy to a specific wallet or protocol.
     */
    target?: PolicyTarget;
    /**
     * - The method(s) to gate. If omitted, all methods are gated.
     */
    method?: string | string[];
    /**
     * - Evaluates whether the method call is allowed.
     */
    evaluate: PolicyEvaluator;
};
import WalletManager from "@tetherto/wdk-wallet";
import { SwapProtocol } from "@tetherto/wdk-wallet/protocols";
import { BridgeProtocol } from "@tetherto/wdk-wallet/protocols";
import { LendingProtocol } from "@tetherto/wdk-wallet/protocols";
import { FiatProtocol } from "@tetherto/wdk-wallet/protocols";