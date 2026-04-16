/**
 * @typedef {import('events').EventEmitter} EventEmitter
 */
/**
 * @typedef {object} WalletConnectConfig
 * @property {string} projectId
 * @property {{ name: string, description: string, url: string, icons: string[] }} metadata
 * @property {string} [relayUrl]
 * @property {{ appId: string, apiKey?: string, baseUrl?: string }} [payConfig]
 * @property {object} [signConfig]
 */
/**
 * Thin wrapper around WalletKit that forwards events to an external EventEmitter
 * and exposes passthrough methods. No internal signing or request processing.
 */
export default class WalletConnectHandler {
    /**
     * @param {EventEmitter} emitter
     */
    constructor(emitter: EventEmitter);
    /** @private */
    private _emitter;
    /** @private */
    private _walletkit;
    /**
     * @param {WalletConnectConfig} config
     */
    init(config: WalletConnectConfig): Promise<void>;
    /**
     * @returns {import('@reown/walletkit').WalletKit | null}
     */
    get walletkit(): import("@reown/walletkit").default | null;
    /**
     * @returns {import('@reown/walletkit').IWalletKitPay | null}
     */
    get pay(): import("@reown/walletkit").IWalletKitPay | null;
    /**
     * @param {string} uri
     */
    pair(uri: string): Promise<void>;
    /**
     * Passthrough to walletkit.approveSession.
     *
     * @param {object} params
     * @param {number} params.id
     * @param {Record<string, object>} params.namespaces
     * @param {object} [params.sessionProperties]
     * @param {object} [params.scopedProperties]
     * @param {object} [params.sessionConfig]
     * @param {string} [params.relayProtocol]
     * @param {object} [params.proposalRequestsResponses]
     * @returns {Promise<object>}
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
     * @param {number} id
     */
    rejectSession(id: number): Promise<void>;
    /**
     * @param {number} id
     * @param {string} topic
     * @param {object} params
     * @param {*} params.result
     */
    respondRequest(id: number, topic: string, { result }: {
        result: any;
    }): Promise<void>;
    /**
     * @param {number} id
     * @param {string} topic
     * @param {string} [message]
     */
    rejectRequest(id: number, topic: string, message?: string): Promise<void>;
    /**
     * @returns {Record<string, object>}
     */
    getSessions(): Record<string, object>;
    /**
     * @returns {Record<number, object>}
     */
    getPendingSessionProposals(): Record<number, object>;
    /**
     * @returns {object[]}
     */
    getPendingSessionRequests(): object[];
    /**
     * @param {string} topic
     */
    disconnectSession(topic: string): Promise<void>;
    /**
     * @param {object} params
     * @param {string} params.topic
     * @param {Record<string, object>} params.namespaces
     */
    updateSession(params: {
        topic: string;
        namespaces: Record<string, object>;
    }): Promise<{
        acknowledged: () => Promise<void>;
    }>;
    /**
     * @param {object} params
     * @param {string} params.topic
     */
    extendSession(params: {
        topic: string;
    }): Promise<{
        acknowledged: () => Promise<void>;
    }>;
    /**
     * @param {object} params
     * @param {string} params.topic
     * @param {*} params.event
     * @param {string} params.chainId
     */
    emitSessionEvent(params: {
        topic: string;
        event: any;
        chainId: string;
    }): Promise<void>;
    /**
     * @param {object} params
     */
    approveSessionAuthenticate(params: object): Promise<{
        session: import("@walletconnect/types").SessionTypes.Struct | undefined;
    }>;
    /**
     * @param {object} params
     * @param {number} params.id
     */
    rejectSessionAuthenticate(params: {
        id: number;
    }): Promise<void>;
    /**
     * @param {object} params
     * @param {{ request: object, iss: string }} params
     * @returns {string}
     */
    formatAuthMessage(params: object): string;
    dispose(): void;
    /** @private */
    private _ensureInitialized;
    /** @private */
    private _subscribeToEvents;
}
export type EventEmitter = import("events").EventEmitter;
export type WalletConnectConfig = {
    projectId: string;
    metadata: {
        name: string;
        description: string;
        url: string;
        icons: string[];
    };
    relayUrl?: string;
    payConfig?: {
        appId: string;
        apiKey?: string;
        baseUrl?: string;
    };
    signConfig?: object;
};
