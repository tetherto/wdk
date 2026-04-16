/** @typedef {import('@tetherto/wdk-wallet').IWalletAccount} IWalletAccount */
/** @typedef {import('@tetherto/wdk-wallet').FeeRates} FeeRates */
/** @typedef {import('./wallet-account-with-protocols.js').IWalletAccountWithProtocols} IWalletAccountWithProtocols */
/** @typedef {import('./walletconnect-handler.js').WalletConnectConfig} WalletConnectConfig */
/** @typedef {<A extends IWalletAccount>(account: A) => Promise<void>} MiddlewareFunction */
export default class WDK extends EventEmitter<any> {
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
    private _wc;
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
     * Initializes WalletConnect (WalletKit) and subscribes to session events.
     * Events are emitted on this WDK instance: session_proposal, session_request,
     * session_delete, session_authenticate, proposal_expire, session_request_expire, payment_link.
     *
     * @param {WalletConnectConfig} config
     * @returns {Promise<WDK>}
     */
    initWalletConnect(config: WalletConnectConfig): Promise<WDK>;
    /**
     * The underlying WalletKit instance. Available after initWalletConnect.
     *
     * @returns {import('@reown/walletkit').WalletKit | null}
     */
    get walletkit(): import("@reown/walletkit").default | null;
    /**
     * The WalletConnect Pay client. Available after initWalletConnect with payConfig.
     *
     * @returns {import('@reown/walletkit').IWalletKitPay | null}
     */
    get pay(): import("@reown/walletkit").IWalletKitPay | null;
    /**
     * Pairs with a dApp via URI or detects a payment link.
     * Payment links emit a 'payment_link' event instead of pairing.
     *
     * @param {string} uri
     * @returns {Promise<void>}
     */
    pair(uri: string): Promise<void>;
    /**
     * Approves a session proposal. Passthrough to WalletKit — all params are forwarded as-is.
     *
     * @param {object} params
     * @param {number} params.id
     * @param {Record<string, object>} params.namespaces
     * @param {object} [params.sessionProperties]
     * @param {object} [params.scopedProperties]
     * @param {object} [params.sessionConfig]
     * @param {string} [params.relayProtocol]
     * @param {object} [params.proposalRequestsResponses]
     * @returns {Promise<object>} The session.
     */
    approveSession(params: {
        id: number;
        namespaces: Record<string, object>;
        sessionProperties?: object;
        scopedProperties?: object;
        sessionConfig?: object;
        relayProtocol?: string;
        proposalRequestsResponses?: object;
    }): Promise<object>;
    /**
     * Rejects a session proposal.
     *
     * @param {number} id
     * @returns {Promise<void>}
     */
    rejectSession(id: number): Promise<void>;
    /**
     * Responds to a session request with a result provided by the consumer.
     *
     * @param {number} id
     * @param {string} topic
     * @param {object} params
     * @param {*} params.result
     * @returns {Promise<void>}
     */
    respondRequest(id: number, topic: string, { result }: {
        result: any;
    }): Promise<void>;
    /**
     * Rejects a session request.
     *
     * @param {number} id
     * @param {string} topic
     * @param {string} [message]
     * @returns {Promise<void>}
     */
    rejectRequest(id: number, topic: string, message?: string): Promise<void>;
    /**
     * Returns all active WalletConnect sessions.
     *
     * @returns {Record<string, object>}
     */
    getSessions(): Record<string, object>;
    /**
     * Returns all pending session proposals.
     *
     * @returns {Record<number, object>}
     */
    getPendingSessionProposals(): Record<number, object>;
    /**
     * Returns all pending session requests.
     *
     * @returns {object[]}
     */
    getPendingSessionRequests(): object[];
    /**
     * Disconnects a WalletConnect session.
     *
     * @param {string} topic
     * @returns {Promise<void>}
     */
    disconnectSession(topic: string): Promise<void>;
    /**
     * Updates a session's namespaces.
     *
     * @param {object} params
     * @param {string} params.topic
     * @param {Record<string, object>} params.namespaces
     * @returns {Promise<{ acknowledged: () => Promise<void> }>}
     */
    updateSession(params: {
        topic: string;
        namespaces: Record<string, object>;
    }): Promise<{
        acknowledged: () => Promise<void>;
    }>;
    /**
     * Extends a session's expiry.
     *
     * @param {object} params
     * @param {string} params.topic
     * @returns {Promise<{ acknowledged: () => Promise<void> }>}
     */
    extendSession(params: {
        topic: string;
    }): Promise<{
        acknowledged: () => Promise<void>;
    }>;
    /**
     * Emits an event to a connected dApp.
     *
     * @param {object} params
     * @param {string} params.topic
     * @param {*} params.event
     * @param {string} params.chainId
     * @returns {Promise<void>}
     */
    emitSessionEvent(params: {
        topic: string;
        event: any;
        chainId: string;
    }): Promise<void>;
    /**
     * Approves a standalone session authentication request.
     *
     * @param {object} params
     * @returns {Promise<{ session: object | undefined }>}
     */
    approveSessionAuthenticate(params: object): Promise<{
        session: object | undefined;
    }>;
    /**
     * Rejects a standalone session authentication request.
     *
     * @param {object} params
     * @param {number} params.id
     * @returns {Promise<void>}
     */
    rejectSessionAuthenticate(params: {
        id: number;
    }): Promise<void>;
    /**
     * Formats an authentication message for signing.
     *
     * @param {object} params
     * @param {object} params.request
     * @param {string} params.iss
     * @returns {string}
     */
    formatAuthMessage(params: {
        request: object;
        iss: string;
    }): string;
    /**
     * Disposes and unregisters wallets, erasing any sensitive data from memory.
     * If no blockchains are specified, all registered wallets are disposed.
     * WalletConnect sessions should be disconnected explicitly via disconnectSession() before calling dispose.
     *
     * @param {string[]} [blockchains] - The blockchains to dispose. If omitted, all wallets are disposed.
     */
    dispose(blockchains?: string[]): void;
    /** @private */
    private _runMiddlewares;
    /** @private */
    private _registerProtocols;
}
export type IWalletAccount = import("@tetherto/wdk-wallet").IWalletAccount;
export type FeeRates = import("@tetherto/wdk-wallet").FeeRates;
export type IWalletAccountWithProtocols = import("./wallet-account-with-protocols.js").IWalletAccountWithProtocols;
export type WalletConnectConfig = import("./walletconnect-handler.js").WalletConnectConfig;
export type MiddlewareFunction = <A extends IWalletAccount>(account: A) => Promise<void>;
import { EventEmitter } from 'events';
import { SwapProtocol } from '@tetherto/wdk-wallet/protocols';
import { BridgeProtocol } from '@tetherto/wdk-wallet/protocols';
import { LendingProtocol } from '@tetherto/wdk-wallet/protocols';
import { FiatProtocol } from '@tetherto/wdk-wallet/protocols';
