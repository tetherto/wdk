'use strict'

import { beforeEach, describe, expect, jest, test } from '@jest/globals'

import WalletManager, { UnsupportedOperationError } from '@tetherto/wdk-wallet'

import { SdaProtocol } from '@tetherto/wdk-wallet/protocols'

import WDK from '../index.js'

const SEED_PHRASE = 'cook voyage document eight skate token alien guide drink uncle term abuse'

const getAccountMock = jest.fn()

const WalletManagerMock = jest.fn().mockImplementation(() => Object.create(WalletManager.prototype, {
  getAccount: { value: getAccountMock },
  getAccountByPath: { value: jest.fn() },
  getFeeRates: { value: jest.fn() },
  dispose: { value: jest.fn() }
}))

// A concrete SDA protocol against the MERGED interface: implements the required
// core, and leaves an optional operation to the base (which must throw).
class TestSdaProtocol extends SdaProtocol {
  async getSupportedRoutes () {
    return [{ sourceChains: ['ethereum'], inputTokens: [], destinationChain: 'ethereum', outputAsset: undefined }]
  }
}

describe('WDK getSdaProtocol (smoke)', () => {
  const CONFIG = { transferMaxFee: 100, transactionMaxFee: 500 }
  const SDA_CONFIG = { apiKey: 'dummy-key' }

  let wdk, account

  beforeEach(async () => {
    getAccountMock.mockResolvedValue({ getAddress: async () => '0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd' })
    wdk = new WDK(SEED_PHRASE)
  })

  test('resolves a WDK-level registered SDA protocol and dispatches a call', async () => {
    // Arrange:
    wdk.registerWallet('ethereum', WalletManagerMock, CONFIG)
      .registerProtocol('ethereum', 'sda', TestSdaProtocol, SDA_CONFIG)

    // Act:
    account = await wdk.getAccount('ethereum', 0)
    const protocol = account.getSdaProtocol('sda')
    const routes = await protocol.getSupportedRoutes()

    // Assert:
    expect(protocol).toBeInstanceOf(TestSdaProtocol)
    expect(protocol).toBeInstanceOf(SdaProtocol)
    expect(routes[0].sourceChains).toEqual(['ethereum'])
  })

  test('resolves an account-level registered SDA protocol', async () => {
    // Arrange:
    wdk.registerWallet('ethereum', WalletManagerMock, CONFIG)
    account = await wdk.getAccount('ethereum', 0)
    account.registerProtocol('sda', TestSdaProtocol, SDA_CONFIG)

    // Act:
    const protocol = account.getSdaProtocol('sda')

    // Assert:
    expect(protocol).toBeInstanceOf(TestSdaProtocol)
  })

  test('an unsupported optional operation throws UnsupportedOperationError through the wiring', async () => {
    // Arrange:
    wdk.registerWallet('ethereum', WalletManagerMock, CONFIG)
      .registerProtocol('ethereum', 'sda', TestSdaProtocol, SDA_CONFIG)
    account = await wdk.getAccount('ethereum', 0)

    // Act / Assert:
    await expect(account.getSdaProtocol('sda').quoteDeposit({})).rejects.toThrow(UnsupportedOperationError)
  })

  test('throws when no SDA protocol is registered for the label', async () => {
    // Arrange:
    wdk.registerWallet('ethereum', WalletManagerMock, CONFIG)
    account = await wdk.getAccount('ethereum', 0)

    // Act / Assert:
    expect(() => account.getSdaProtocol('missing')).toThrow('No sda protocol registered for label: missing.')
  })
})
