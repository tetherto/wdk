'use strict'

import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, test, jest } from '@jest/globals'
import { SignClient } from '@walletconnect/sign-client'
import { Core } from '@walletconnect/core'

import WDK from '../index.js'

dotenv.config()

const WALLETCONNECT_PROJECT_ID = process.env.WALLETCONNECT_PROJECT_ID
const describeE2E = WALLETCONNECT_PROJECT_ID ? describe : describe.skip

const WALLET_METADATA = {
  name: 'WDK E2E Wallet',
  description: 'E2E test wallet',
  url: 'https://wdk-test.example.com',
  icons: ['https://wdk-test.example.com/icon.png']
}

const DAPP_METADATA = {
  name: 'WDK E2E dApp',
  description: 'E2E test dApp',
  url: 'https://dapp-test.example.com',
  icons: ['https://dapp-test.example.com/icon.png']
}

const OPTIONAL_NAMESPACES = {
  eip155: {
    methods: ['personal_sign'],
    chains: ['eip155:1'],
    events: ['chainChanged', 'accountsChanged']
  }
}

const TEST_ACCOUNT = 'eip155:1:0x1234567890abcdef1234567890abcdef12345678'

function buildApprovedNamespaces () {
  return {
    eip155: {
      accounts: [TEST_ACCOUNT],
      methods: ['personal_sign'],
      events: ['chainChanged', 'accountsChanged']
    }
  }
}

function waitForEvent (emitter, event, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for "${event}"`)), timeoutMs)
    emitter.once(event, (payload) => {
      clearTimeout(timer)
      resolve(payload)
    })
  })
}

describeE2E('WalletConnect E2E', () => {
  let wdk
  let signClient

  beforeAll(async () => {
    const seed = WDK.getRandomSeedPhrase()
    wdk = new WDK(seed)

    await wdk.initWalletConnect({
      projectId: WALLETCONNECT_PROJECT_ID,
      metadata: WALLET_METADATA
    })

    // Clear the global Core singleton so the dApp gets its own independent
    // Core and relay connection (in production they'd be separate processes).
    delete globalThis._walletConnectCore_
    delete globalThis._walletConnectCore__count

    const dappCore = new Core({
      projectId: WALLETCONNECT_PROJECT_ID
    })

    signClient = await SignClient.init({
      core: dappCore,
      metadata: DAPP_METADATA
    })
  }, 30000)

  afterAll(async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const sessions = signClient.session.getAll()
      for (const session of sessions) {
        await signClient.disconnect({
          topic: session.topic,
          reason: { code: 6000, message: 'test cleanup' }
        }).catch(() => {})
      }
    } catch (_) {}

    wdk.dispose()
    spy.mockRestore()
  }, 15000)

  test('should initialize without error and have no sessions', () => {
    // #given / #when — init happened in beforeAll

    // #then
    const sessions = wdk.getSessions()
    expect(Object.keys(sessions)).toHaveLength(0)
  })

  test('full session lifecycle: pair, approve, request, respond, disconnect', async () => {
    // #given — dApp initiates connection
    const { uri, approval } = await signClient.connect({
      optionalNamespaces: OPTIONAL_NAMESPACES
    })

    // #when — wallet pairs and auto-approves the proposal
    const proposalPromise = waitForEvent(wdk, 'session_proposal')
    await wdk.pair(uri)

    const proposal = await proposalPromise
    await wdk.approveSession({
      id: proposal.id,
      namespaces: buildApprovedNamespaces()
    })

    const session = await approval()

    // #then — session is established on both sides
    expect(session.topic).toBeDefined()
    const wdkSessions = wdk.getSessions()
    expect(wdkSessions[session.topic]).toBeDefined()

    // #when — dApp sends a personal_sign request
    const requestPromise = waitForEvent(wdk, 'session_request')
    const FAKE_SIGNATURE = '0xdeadbeef'

    const resultPromise = signClient.request({
      topic: session.topic,
      chainId: 'eip155:1',
      request: {
        method: 'personal_sign',
        params: ['0x48656c6c6f', TEST_ACCOUNT]
      }
    })

    const request = await requestPromise

    // #then — request is received with correct method
    expect(request.params.request.method).toBe('personal_sign')

    // #when — wallet responds
    await wdk.respondRequest(request.id, request.topic, { result: FAKE_SIGNATURE })

    // #then — dApp receives the signature
    const result = await resultPromise
    expect(result).toBe(FAKE_SIGNATURE)

    // #when — dApp disconnects
    const deletePromise = waitForEvent(wdk, 'session_delete')
    await signClient.disconnect({
      topic: session.topic,
      reason: { code: 6000, message: 'test done' }
    })

    // #then — wallet receives session_delete
    const deleteEvent = await deletePromise
    expect(deleteEvent.topic).toBe(session.topic)
    
  }, 30000)

  test('reject session: dApp should receive rejection', async () => {
    // #given
    const { uri, approval } = await signClient.connect({
      optionalNamespaces: OPTIONAL_NAMESPACES
    })

    // #when — wallet pairs and rejects
    const proposalPromise = waitForEvent(wdk, 'session_proposal')
    await wdk.pair(uri)

    const proposal = await proposalPromise
    await wdk.rejectSession(proposal.id)

    // #then — dApp approval should reject
    await expect(approval()).rejects.toBeDefined()
  }, 30000)

  test('reject request: dApp should receive error', async () => {
    // #given — establish a session
    const { uri, approval } = await signClient.connect({
      optionalNamespaces: OPTIONAL_NAMESPACES
    })

    const proposalPromise = waitForEvent(wdk, 'session_proposal')
    await wdk.pair(uri)

    const proposal = await proposalPromise
    await wdk.approveSession({
      id: proposal.id,
      namespaces: buildApprovedNamespaces()
    })

    const session = await approval()

    // #when — dApp sends request and wallet rejects it
    const requestPromise = waitForEvent(wdk, 'session_request')

    const resultPromise = signClient.request({
      topic: session.topic,
      chainId: 'eip155:1',
      request: {
        method: 'personal_sign',
        params: ['0x48656c6c6f', TEST_ACCOUNT]
      }
    })

    const request = await requestPromise
    await wdk.rejectRequest(request.id, request.topic, 'User declined')

    // #then — dApp should receive an error
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    try {
      await expect(resultPromise).rejects.toBeDefined()
    } finally {
      spy.mockRestore()
    }

    // cleanup
    await signClient.disconnect({
      topic: session.topic,
      reason: { code: 6000, message: 'test cleanup' }
    }).catch(() => {})
  }, 30000)
})
