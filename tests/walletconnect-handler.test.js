'use strict'

import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { EventEmitter } from 'events'

const mockWalletKitInstance = {
  on: jest.fn(),
  pair: jest.fn(),
  approveSession: jest.fn(),
  rejectSession: jest.fn(),
  respondSessionRequest: jest.fn(),
  getActiveSessions: jest.fn(),
  getPendingSessionProposals: jest.fn(),
  getPendingSessionRequests: jest.fn(),
  disconnectSession: jest.fn(),
  updateSession: jest.fn(),
  extendSession: jest.fn(),
  emitSessionEvent: jest.fn(),
  approveSessionAuthenticate: jest.fn(),
  rejectSessionAuthenticate: jest.fn(),
  formatAuthMessage: jest.fn(),
  pay: { getPaymentOptions: jest.fn() }
}

jest.unstable_mockModule('@reown/walletkit', () => ({
  WalletKit: {
    init: jest.fn().mockResolvedValue(mockWalletKitInstance)
  },
  isPaymentLink: jest.fn((uri) => uri.startsWith('wc:pay'))
}))

jest.unstable_mockModule('@walletconnect/core', () => ({
  Core: jest.fn()
}))

jest.unstable_mockModule('@walletconnect/utils', () => ({
  getSdkError: jest.fn((type) => ({ message: type, code: 0 }))
}))

const { default: WalletConnectHandler } = await import('../src/walletconnect-handler.js')

describe('WalletConnectHandler', () => {
  let handler
  let emitter

  const CONFIG = {
    projectId: 'test-project-id',
    metadata: {
      name: 'Test',
      description: 'Test wallet',
      url: 'https://test.com',
      icons: ['https://test.com/icon.png']
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
    emitter = new EventEmitter()
    handler = new WalletConnectHandler(emitter)
  })

  describe('init', () => {
    test('should initialize WalletKit and subscribe to events', async () => {
      await handler.init(CONFIG)

      expect(mockWalletKitInstance.on).toHaveBeenCalledWith('session_proposal', expect.any(Function))
      expect(mockWalletKitInstance.on).toHaveBeenCalledWith('session_request', expect.any(Function))
      expect(mockWalletKitInstance.on).toHaveBeenCalledWith('session_delete', expect.any(Function))
      expect(mockWalletKitInstance.on).toHaveBeenCalledWith('session_authenticate', expect.any(Function))
      expect(mockWalletKitInstance.on).toHaveBeenCalledWith('proposal_expire', expect.any(Function))
      expect(mockWalletKitInstance.on).toHaveBeenCalledWith('session_request_expire', expect.any(Function))
    })
  })

  describe('walletkit getter', () => {
    test('should return null before init', () => {
      expect(handler.walletkit).toBeNull()
    })

    test('should return the walletkit instance after init', async () => {
      await handler.init(CONFIG)
      expect(handler.walletkit).toBe(mockWalletKitInstance)
    })
  })

  describe('before init', () => {
    test('should throw when calling methods before init', async () => {
      await expect(handler.pair('wc:test')).rejects.toThrow('WalletConnect not initialized')
      expect(() => handler.getSessions()).toThrow('WalletConnect not initialized')
    })
  })

  describe('pair', () => {
    beforeEach(async () => {
      await handler.init(CONFIG)
    })

    test('should call walletkit.pair for regular URIs', async () => {
      // #given
      const uri = 'wc:abc123@2?relay-protocol=irn'

      // #when
      await handler.pair(uri)

      // #then
      expect(mockWalletKitInstance.pair).toHaveBeenCalledWith({ uri })
    })

    test('should emit payment_link for payment URIs', async () => {
      // #given
      const uri = 'wc:pay-link-123'
      const listener = jest.fn()
      emitter.on('payment_link', listener)

      // #when
      await handler.pair(uri)

      // #then
      expect(listener).toHaveBeenCalledWith({ uri })
      expect(mockWalletKitInstance.pair).not.toHaveBeenCalled()
    })
  })

  describe('approveSession', () => {
    beforeEach(async () => {
      await handler.init(CONFIG)
    })

    test('should passthrough params to walletkit.approveSession', async () => {
      // #given
      const params = {
        id: 1,
        namespaces: { eip155: { accounts: ['eip155:1:0xabc'], methods: ['personal_sign'], events: [] } }
      }

      // #when
      await handler.approveSession(params)

      // #then
      expect(mockWalletKitInstance.approveSession).toHaveBeenCalledWith(params)
    })
  })

  describe('rejectSession', () => {
    beforeEach(async () => {
      await handler.init(CONFIG)
    })

    test('should reject with USER_REJECTED reason', async () => {
      // #when
      await handler.rejectSession(42)

      // #then
      expect(mockWalletKitInstance.rejectSession).toHaveBeenCalledWith({
        id: 42,
        reason: { message: 'USER_REJECTED', code: 0 }
      })
    })
  })

  describe('respondRequest', () => {
    beforeEach(async () => {
      await handler.init(CONFIG)
    })

    test('should format and forward the result', async () => {
      // #given
      const result = '0xsignature'

      // #when
      await handler.respondRequest(1, 'topic-1', { result })

      // #then
      expect(mockWalletKitInstance.respondSessionRequest).toHaveBeenCalledWith({
        topic: 'topic-1',
        response: { id: 1, jsonrpc: '2.0', result: '0xsignature' }
      })
    })
  })

  describe('rejectRequest', () => {
    beforeEach(async () => {
      await handler.init(CONFIG)
    })

    test('should format and forward an error', async () => {
      // #when
      await handler.rejectRequest(1, 'topic-1')

      // #then
      expect(mockWalletKitInstance.respondSessionRequest).toHaveBeenCalledWith({
        topic: 'topic-1',
        response: { id: 1, jsonrpc: '2.0', error: { code: -32000, message: 'USER_REJECTED' } }
      })
    })

    test('should use custom message when provided', async () => {
      // #when
      await handler.rejectRequest(1, 'topic-1', 'custom error')

      // #then
      expect(mockWalletKitInstance.respondSessionRequest).toHaveBeenCalledWith({
        topic: 'topic-1',
        response: { id: 1, jsonrpc: '2.0', error: { code: -32000, message: 'custom error' } }
      })
    })
  })

  describe('session management', () => {
    beforeEach(async () => {
      await handler.init(CONFIG)
    })

    test('getSessions should return active sessions', () => {
      // #given
      const sessions = { 'topic-1': { peer: {} } }
      mockWalletKitInstance.getActiveSessions.mockReturnValue(sessions)

      // #when / #then
      expect(handler.getSessions()).toBe(sessions)
    })

    test('getPendingSessionProposals should return pending proposals', () => {
      // #given
      const proposals = { 1: { id: 1 } }
      mockWalletKitInstance.getPendingSessionProposals.mockReturnValue(proposals)

      // #when / #then
      expect(handler.getPendingSessionProposals()).toBe(proposals)
    })

    test('getPendingSessionRequests should return pending requests', () => {
      // #given
      const requests = [{ id: 1 }]
      mockWalletKitInstance.getPendingSessionRequests.mockReturnValue(requests)

      // #when / #then
      expect(handler.getPendingSessionRequests()).toBe(requests)
    })

    test('disconnectSession should disconnect with USER_DISCONNECTED', async () => {
      // #when
      await handler.disconnectSession('topic-1')

      // #then
      expect(mockWalletKitInstance.disconnectSession).toHaveBeenCalledWith({
        topic: 'topic-1',
        reason: { message: 'USER_DISCONNECTED', code: 0 }
      })
    })

    test('updateSession should passthrough params', async () => {
      // #given
      const params = { topic: 'topic-1', namespaces: {} }

      // #when
      await handler.updateSession(params)

      // #then
      expect(mockWalletKitInstance.updateSession).toHaveBeenCalledWith(params)
    })

    test('extendSession should passthrough params', async () => {
      // #given
      const params = { topic: 'topic-1' }

      // #when
      await handler.extendSession(params)

      // #then
      expect(mockWalletKitInstance.extendSession).toHaveBeenCalledWith(params)
    })

    test('emitSessionEvent should passthrough params', async () => {
      // #given
      const params = { topic: 'topic-1', event: { name: 'accountsChanged' }, chainId: 'eip155:1' }

      // #when
      await handler.emitSessionEvent(params)

      // #then
      expect(mockWalletKitInstance.emitSessionEvent).toHaveBeenCalledWith(params)
    })
  })

  describe('auth', () => {
    beforeEach(async () => {
      await handler.init(CONFIG)
    })

    test('approveSessionAuthenticate should passthrough params', async () => {
      // #given
      const params = { id: 1, auths: [] }

      // #when
      await handler.approveSessionAuthenticate(params)

      // #then
      expect(mockWalletKitInstance.approveSessionAuthenticate).toHaveBeenCalledWith(params)
    })

    test('rejectSessionAuthenticate should reject with USER_REJECTED', async () => {
      // #when
      await handler.rejectSessionAuthenticate({ id: 1 })

      // #then
      expect(mockWalletKitInstance.rejectSessionAuthenticate).toHaveBeenCalledWith({
        id: 1,
        reason: { message: 'USER_REJECTED', code: 0 }
      })
    })

    test('formatAuthMessage should passthrough params', () => {
      // #given
      const params = { request: {}, iss: 'did:pkh:eip155:1:0xabc' }
      mockWalletKitInstance.formatAuthMessage.mockReturnValue('Sign this message')

      // #when
      const result = handler.formatAuthMessage(params)

      // #then
      expect(result).toBe('Sign this message')
      expect(mockWalletKitInstance.formatAuthMessage).toHaveBeenCalledWith(params)
    })
  })

  describe('pay', () => {
    test('should return null before init', () => {
      expect(handler.pay).toBeNull()
    })

    test('should return the pay client after init', async () => {
      // #given
      await handler.init(CONFIG)

      // #then
      expect(handler.pay).toBe(mockWalletKitInstance.pay)
    })
  })

  describe('event forwarding', () => {
    test('should forward walletkit events to the emitter', async () => {
      // #given
      await handler.init(CONFIG)

      const events = ['session_proposal', 'session_request', 'session_delete',
        'session_authenticate', 'proposal_expire', 'session_request_expire']

      for (const event of events) {
        const listener = jest.fn()
        emitter.on(event, listener)

        const onCall = mockWalletKitInstance.on.mock.calls.find(c => c[0] === event)
        const payload = { id: 1, topic: 'test' }

        // #when
        onCall[1](payload)

        // #then
        expect(listener).toHaveBeenCalledWith(payload)

        emitter.removeListener(event, listener)
      }
    })
  })

  describe('dispose', () => {
    test('should clear walletkit reference', async () => {
      // #given
      await handler.init(CONFIG)

      // #when
      handler.dispose()

      // #then
      expect(handler.pay).toBeNull()
    })

    test('should be a no-op when not initialized', () => {
      handler.dispose()
    })
  })
})
