'use strict'

import { WalletKit, isPaymentLink } from '@reown/walletkit'
import { Core } from '@walletconnect/core'
import { getSdkError } from '@walletconnect/utils'

function formatJsonRpcResult (id, result) {
  return { id, jsonrpc: '2.0', result }
}

function formatJsonRpcError (id, message) {
  return { id, jsonrpc: '2.0', error: { code: -32000, message } }
}

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
  constructor (emitter) {
    /** @private */
    this._emitter = emitter

    /** @private */
    this._walletkit = null
  }

  /**
   * @param {WalletConnectConfig} config
   */
  async init (config) {
    const core = new Core({
      projectId: config.projectId,
      relayUrl: config.relayUrl
    })
    this._walletkit = await WalletKit.init({
      core,
      metadata: config.metadata,
      signConfig: config.signConfig ?? { disableRequestQueue: true },
      payConfig: config.payConfig
    })

    this._subscribeToEvents()
  }

  /**
   * @returns {import('@reown/walletkit').WalletKit | null}
   */
  get walletkit () {
    return this._walletkit ?? null
  }

  /**
   * @returns {import('@reown/walletkit').IWalletKitPay | null}
   */
  get pay () {
    return this._walletkit?.pay ?? null
  }

  /**
   * @param {string} uri
   */
  async pair (uri) {
    this._ensureInitialized()

    if (isPaymentLink(uri)) {
      this._emitter.emit('payment_link', { uri })
      return
    }

    await this._walletkit.pair({ uri })
  }

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
  async approveSession (params) {
    this._ensureInitialized()
    return this._walletkit.approveSession(params)
  }

  /**
   * @param {number} id
   */
  async rejectSession (id) {
    this._ensureInitialized()
    await this._walletkit.rejectSession({
      id,
      reason: getSdkError('USER_REJECTED')
    })
  }

  /**
   * @param {number} id
   * @param {string} topic
   * @param {object} params
   * @param {*} params.result
   */
  async respondRequest (id, topic, { result }) {
    this._ensureInitialized()
    await this._walletkit.respondSessionRequest({
      topic,
      response: formatJsonRpcResult(id, result)
    })
  }

  /**
   * @param {number} id
   * @param {string} topic
   * @param {string} [message]
   */
  async rejectRequest (id, topic, message) {
    this._ensureInitialized()
    await this._walletkit.respondSessionRequest({
      topic,
      response: formatJsonRpcError(id, message ?? getSdkError('USER_REJECTED').message)
    })
  }

  /**
   * @returns {Record<string, object>}
   */
  getSessions () {
    this._ensureInitialized()
    return this._walletkit.getActiveSessions()
  }

  /**
   * @returns {Record<number, object>}
   */
  getPendingSessionProposals () {
    this._ensureInitialized()
    return this._walletkit.getPendingSessionProposals()
  }

  /**
   * @returns {object[]}
   */
  getPendingSessionRequests () {
    this._ensureInitialized()
    return this._walletkit.getPendingSessionRequests()
  }

  /**
   * @param {string} topic
   */
  async disconnectSession (topic) {
    this._ensureInitialized()
    await this._walletkit.disconnectSession({
      topic,
      reason: getSdkError('USER_DISCONNECTED')
    })
  }

  /**
   * @param {object} params
   * @param {string} params.topic
   * @param {Record<string, object>} params.namespaces
   */
  async updateSession (params) {
    this._ensureInitialized()
    return this._walletkit.updateSession(params)
  }

  /**
   * @param {object} params
   * @param {string} params.topic
   */
  async extendSession (params) {
    this._ensureInitialized()
    return this._walletkit.extendSession(params)
  }

  /**
   * @param {object} params
   * @param {string} params.topic
   * @param {*} params.event
   * @param {string} params.chainId
   */
  async emitSessionEvent (params) {
    this._ensureInitialized()
    await this._walletkit.emitSessionEvent(params)
  }

  /**
   * @param {object} params
   */
  async approveSessionAuthenticate (params) {
    this._ensureInitialized()
    return this._walletkit.approveSessionAuthenticate(params)
  }

  /**
   * @param {object} params
   * @param {number} params.id
   */
  async rejectSessionAuthenticate (params) {
    this._ensureInitialized()
    await this._walletkit.rejectSessionAuthenticate({
      id: params.id,
      reason: getSdkError('USER_REJECTED')
    })
  }

  /**
   * @param {object} params
   * @param {{ request: object, iss: string }} params
   * @returns {string}
   */
  formatAuthMessage (params) {
    this._ensureInitialized()
    return this._walletkit.formatAuthMessage(params)
  }

  dispose () {
    this._walletkit = null
  }

  /** @private */
  _ensureInitialized () {
    if (!this._walletkit) {
      throw new Error('WalletConnect not initialized. Call initWalletConnect() first.')
    }
  }

  /** @private */
  _subscribeToEvents () {
    this._walletkit.on('session_proposal', (payload) => {
      this._emitter.emit('session_proposal', payload)
    })

    this._walletkit.on('session_request', (payload) => {
      this._emitter.emit('session_request', payload)
    })

    this._walletkit.on('session_delete', (payload) => {
      this._emitter.emit('session_delete', payload)
    })

    this._walletkit.on('session_authenticate', (payload) => {
      this._emitter.emit('session_authenticate', payload)
    })

    this._walletkit.on('proposal_expire', (payload) => {
      this._emitter.emit('proposal_expire', payload)
    })

    this._walletkit.on('session_request_expire', (payload) => {
      this._emitter.emit('session_request_expire', payload)
    })
  }
}
