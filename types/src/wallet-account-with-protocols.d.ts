/** @typedef {import('@tetherto/wdk-wallet/protocols').ISwapProtocol} ISwapProtocol */
/** @typedef {typeof import('@tetherto/wdk-wallet/protocols').SwapProtocol} SwapProtocolCtor */
/** @typedef {import('@tetherto/wdk-wallet/protocols').IBridgeProtocol} IBridgeProtocol */
/** @typedef {typeof import('@tetherto/wdk-wallet/protocols').BridgeProtocol} BridgeProtocolCtor */
/** @typedef {import('@tetherto/wdk-wallet/protocols').ILendingProtocol} ILendingProtocol */
/** @typedef {typeof import('@tetherto/wdk-wallet/protocols').LendingProtocol} LendingProtocolCtor */
/** @typedef {import('@tetherto/wdk-wallet/protocols').IFiatProtocol} IFiatProtocol */
/** @typedef {typeof import('@tetherto/wdk-wallet/protocols').FiatProtocol} FiatProtocolCtor */
/** @typedef {import('@tetherto/wdk-wallet/protocols').ISwidgeProtocol} ISwidgeProtocol */
/** @typedef {typeof import('@tetherto/wdk-wallet/protocols').SwidgeProtocol} SwidgeProtocolCtor */
/**
 * Interface for wallet accounts that also expose the WDK's protocol-getter
 * helpers (`registerProtocol`, `getSwapProtocol`, `getBridgeProtocol`,
 * `getLendingProtocol`, `getFiatProtocol`, `getSwidgeProtocol`). The
 * concrete shape is materialized at runtime by `wdk.getAccount` /
 * `getAccountByPath` after middlewares and protocol getters have been
 * installed. See `WdkAccount` for the consumer-facing type that pairs
 * this surface with the underlying `IWalletAccount` shape.
 *
 * @interface
 */
export class IWalletAccountWithProtocols {
    /**
     * Registers a new protocol for this account
     *
     * The label must be unique in the scope of the account and the type of protocol (i.e., there can’t be two protocols of the same
     * type bound to the same account with the same label).
     *
     * @template {SwapProtocolCtor | BridgeProtocolCtor | LendingProtocolCtor | FiatProtocolCtor | SwidgeProtocolCtor} P
     * @param {string} label - The label.
     * @param {P} Protocol - The protocol class.
     * @param {ConstructorParameters<P>[1]} config - The protocol configuration.
     * @returns {IWalletAccountWithProtocols} The account.
     */
    registerProtocol<P extends SwapProtocolCtor | BridgeProtocolCtor | LendingProtocolCtor | FiatProtocolCtor | SwidgeProtocolCtor>(label: string, Protocol: P, config: ConstructorParameters<P>[1]): IWalletAccountWithProtocols;
    /**
     * Returns the swap protocol with the given label.
     *
     * @param {string} label - The label.
     * @returns {ISwapProtocol} The swap protocol.
     * @throws {Error} If no swap protocol has been registered on this account with the given label.
     */
    getSwapProtocol(label: string): ISwapProtocol;
    /**
     * Returns the bridge protocol with the given label.
     *
     * @param {string} label - The label.
     * @returns {IBridgeProtocol} The bridge protocol.
     * @throws {Error} If no bridge protocol has been registered on this account with the given label.
     */
    getBridgeProtocol(label: string): IBridgeProtocol;
    /**
     * Returns the lending protocol with the given label.
     *
     * @param {string} label - The label.
     * @returns {ILendingProtocol} The lending protocol.
     * @throws {Error} If no lending protocol has been registered on this account with the given label.
     */
    getLendingProtocol(label: string): ILendingProtocol;
    /**
     * Returns the fiat protocol with the given label.
     *
     * @param {string} label - The label.
     * @returns {IFiatProtocol} The fiat protocol.
     * @throws {Error} If no fiat protocol has been registered on this account with the given label.
     */
    getFiatProtocol(label: string): IFiatProtocol;
    /**
     * Returns the swidge protocol with the given label.
     *
     * @param {string} label - The label.
     * @returns {ISwidgeProtocol} The swidge protocol.
     * @throws {Error} If no swidge protocol has been registered on this account with the given label.
     */
    getSwidgeProtocol(label: string): ISwidgeProtocol;
}
export type ISwapProtocol = import("@tetherto/wdk-wallet/protocols").ISwapProtocol;
export type SwapProtocolCtor = typeof import("@tetherto/wdk-wallet/protocols").SwapProtocol;
export type IBridgeProtocol = import("@tetherto/wdk-wallet/protocols").IBridgeProtocol;
export type BridgeProtocolCtor = typeof import("@tetherto/wdk-wallet/protocols").BridgeProtocol;
export type ILendingProtocol = import("@tetherto/wdk-wallet/protocols").ILendingProtocol;
export type LendingProtocolCtor = typeof import("@tetherto/wdk-wallet/protocols").LendingProtocol;
export type IFiatProtocol = import("@tetherto/wdk-wallet/protocols").IFiatProtocol;
export type FiatProtocolCtor = typeof import("@tetherto/wdk-wallet/protocols").FiatProtocol;
export type ISwidgeProtocol = import("@tetherto/wdk-wallet/protocols").ISwidgeProtocol;
export type SwidgeProtocolCtor = typeof import("@tetherto/wdk-wallet/protocols").SwidgeProtocol;
