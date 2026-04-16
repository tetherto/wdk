'use strict'

import { beforeEach, describe, expect, jest, test } from '@jest/globals'

import WalletManager from '@tetherto/wdk-wallet'

import { BridgeProtocol, LendingProtocol, SwapProtocol } from '@tetherto/wdk-wallet/protocols'

const mockWcHandler = {
  init: jest.fn(),
  pair: jest.fn(),
  approveSession: jest.fn(),
  rejectSession: jest.fn(),
  respondRequest: jest.fn(),
  rejectRequest: jest.fn(),
  getSessions: jest.fn(),
  getPendingSessionProposals: jest.fn(),
  getPendingSessionRequests: jest.fn(),
  disconnectSession: jest.fn(),
  updateSession: jest.fn(),
  extendSession: jest.fn(),
  emitSessionEvent: jest.fn(),
  approveSessionAuthenticate: jest.fn(),
  rejectSessionAuthenticate: jest.fn(),
  formatAuthMessage: jest.fn(),
  dispose: jest.fn(),
  pay: null
}

jest.unstable_mockModule('../src/walletconnect-handler.js', () => ({
  default: jest.fn().mockImplementation(() => mockWcHandler)
}))

const { default: WdkManager } = await import('../index.js')

const SEED_PHRASE = 'cook voyage document eight skate token alien guide drink uncle term abuse'

const getAccountMock = jest.fn(),
      getAccountByPathMock = jest.fn(),
      getFeeRatesMock = jest.fn(),
      disposeMock = jest.fn()

const WalletManagerMock = jest.fn().mockImplementation((seed, config) => {
  return Object.create(WalletManager.prototype, {
    getAccount: {
      value: getAccountMock
    },
    getAccountByPath: {
      value: getAccountByPathMock
    },
    getFeeRates: {
      value: getFeeRatesMock
    },
    dispose: {
      value: disposeMock
    }
  })
})

describe('WdkManager', () => {
  const DUMMY_ACCOUNT = {
    getAddress: async () => {
      return '0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd'
    }
  }

  const CONFIG = { transferMaxFee: 100 }

  let wdkManager

  beforeEach(() => {
    wdkManager = new WdkManager(SEED_PHRASE)
  })

  describe('getAccount', () => {
    beforeEach(() => {
      getAccountMock.mockResolvedValue(DUMMY_ACCOUNT)
    })

    test('should return the account at the given index', async () => {
      wdkManager.registerWallet('ethereum', WalletManagerMock, CONFIG)

      const account = await wdkManager.getAccount('ethereum', 0)

      expect(WalletManagerMock).toHaveBeenCalledWith(SEED_PHRASE, CONFIG)

      expect(getAccountMock).toHaveBeenCalledWith(0)

      expect(account).toEqual(DUMMY_ACCOUNT)
    })

    test('should trigger middlewares', async () => {
      const middleware = jest.fn()

      wdkManager.registerWallet('ethereum', WalletManagerMock, CONFIG)
                .registerMiddleware('ethereum', middleware)

      const account = await wdkManager.getAccount('ethereum', 0)

      expect(middleware).toHaveBeenCalledWith(DUMMY_ACCOUNT)

      expect(account).toEqual(DUMMY_ACCOUNT)
    })

    test('should throw if no wallet has been registered for the given blockchain', async () => {
      await expect(wdkManager.getAccount('ethereum', 0))
        .rejects.toThrow('No wallet registered for blockchain: ethereum.')
    })

    describe('should decorate the account instance with', () => {
      describe('getSwapProtocol', () => {
        const SWAP_CONFIG = { swapMaxFee: 100 }

        let SwapProtocolMock

        beforeEach(() => {
          SwapProtocolMock = jest.fn()

          Object.setPrototypeOf(SwapProtocolMock.prototype, SwapProtocol.prototype)
        })

        test("should return the swap protocol registered for the account's blockchain and the given label", async () => {
          wdkManager.registerWallet('ethereum', WalletManagerMock, CONFIG)
                    .registerProtocol('ethereum', 'test', SwapProtocolMock, SWAP_CONFIG)

          const account = await wdkManager.getAccount('ethereum', 0)

          const protocol = account.getSwapProtocol('test')

          expect(SwapProtocolMock).toHaveBeenCalledWith(account, SWAP_CONFIG)

          expect(protocol).toBeInstanceOf(SwapProtocolMock)
        })

        test('should return the swap protocol registered for the account and the given label', async () => {
          wdkManager.registerWallet('ethereum', WalletManagerMock, CONFIG)

          const account = await wdkManager.getAccount('ethereum', 0)

          account.registerProtocol('test', SwapProtocolMock, SWAP_CONFIG)

          const protocol = account.getSwapProtocol('test')

          expect(SwapProtocolMock).toHaveBeenCalledWith(account, SWAP_CONFIG)

          expect(protocol).toBeInstanceOf(SwapProtocolMock)
        })

        test('should throw if no swap protocol has been registered for the given label', async () => {
          wdkManager.registerWallet('ethereum', WalletManagerMock, CONFIG)

          const account = await wdkManager.getAccount('ethereum', 0)

          expect(() => account.getSwapProtocol('test'))
            .toThrow('No swap protocol registered for label: test.')
        })
      })

      describe('getBridgeProtocol', () => {
        const BRIDGE_CONFIG = { bridgeMaxFee: 100 }

        let BridgeProtocolMock

        beforeEach(() => {
          BridgeProtocolMock = jest.fn()

          Object.setPrototypeOf(BridgeProtocolMock.prototype, BridgeProtocol.prototype)
        })

        test("should return the bridge protocol registered for the account's blockchain and the given label", async () => {
          wdkManager.registerWallet('ethereum', WalletManagerMock, CONFIG)
                    .registerProtocol('ethereum', 'test', BridgeProtocolMock, BRIDGE_CONFIG)

          const account = await wdkManager.getAccount('ethereum', 0)

          const protocol = account.getBridgeProtocol('test')

          expect(BridgeProtocolMock).toHaveBeenCalledWith(account, BRIDGE_CONFIG)

          expect(protocol).toBeInstanceOf(BridgeProtocolMock)
        })

        test('should return the bridge protocol registered for the account and the given label', async () => {
          wdkManager.registerWallet('ethereum', WalletManagerMock, CONFIG)

          const account = await wdkManager.getAccount('ethereum', 0)

          account.registerProtocol('test', BridgeProtocolMock, BRIDGE_CONFIG)

          const protocol = account.getBridgeProtocol('test')

          expect(BridgeProtocolMock).toHaveBeenCalledWith(account, BRIDGE_CONFIG)

          expect(protocol).toBeInstanceOf(BridgeProtocolMock)
        })

        test('should throw if no bridge protocol has been registered for the given label', async () => {
          wdkManager.registerWallet('ethereum', WalletManagerMock, CONFIG)

          const account = await wdkManager.getAccount('ethereum', 0)

          expect(() => account.getBridgeProtocol('test'))
            .toThrow('No bridge protocol registered for label: test.')
        })
      })

      describe('getLendingProtocol', () => {
        let LendingProtocolMock

        beforeEach(() => {
          LendingProtocolMock = jest.fn()

          Object.setPrototypeOf(LendingProtocolMock.prototype, LendingProtocol.prototype)
        })

        test("should return the lending protocol registered for the account's blockchain and the given label", async () => {
          wdkManager.registerWallet('ethereum', WalletManagerMock, CONFIG)
                    .registerProtocol('ethereum', 'test', LendingProtocolMock, undefined)

          const account = await wdkManager.getAccount('ethereum', 0)

          const protocol = account.getLendingProtocol('test')

          expect(LendingProtocolMock).toHaveBeenCalledWith(account, undefined)

          expect(protocol).toBeInstanceOf(LendingProtocolMock)
        })

        test('should return the lending protocol registered for the account and the given label', async () => {
          wdkManager.registerWallet('ethereum', WalletManagerMock, CONFIG)

          const account = await wdkManager.getAccount('ethereum', 0)

          account.registerProtocol('test', LendingProtocolMock, undefined)

          const protocol = account.getLendingProtocol('test')

          expect(LendingProtocolMock).toHaveBeenCalledWith(account, undefined)

          expect(protocol).toBeInstanceOf(LendingProtocolMock)
        })

        test('should throw if no lending protocol has been registered for the given label', async () => {
          wdkManager.registerWallet('ethereum', WalletManagerMock, CONFIG)

          const account = await wdkManager.getAccount('ethereum', 0)

          expect(() => account.getLendingProtocol('test'))
            .toThrow('No lending protocol registered for label: test.')
        })
      })
    })
  })

  describe('getAccountByPath', () => {
    beforeEach(() => {
      getAccountByPathMock.mockResolvedValue(DUMMY_ACCOUNT)
    })

    test('should return the account at the given path', async () => {
      wdkManager.registerWallet('ethereum', WalletManagerMock, CONFIG)

      const account = await wdkManager.getAccountByPath('ethereum', "0'/0/0")

      expect(WalletManagerMock).toHaveBeenCalledWith(SEED_PHRASE, CONFIG)

      expect(getAccountByPathMock).toHaveBeenCalledWith("0'/0/0")

      expect(account).toEqual(DUMMY_ACCOUNT)
    })

    test('should trigger middlewares', async () => {
      const middleware = jest.fn()

      wdkManager.registerWallet('ethereum', WalletManagerMock, CONFIG)
                .registerMiddleware('ethereum', middleware)

      const account = await wdkManager.getAccountByPath('ethereum', "0'/0/0")

      expect(middleware).toHaveBeenCalledWith(DUMMY_ACCOUNT)

      expect(account).toEqual(DUMMY_ACCOUNT)
    })

    test('should throw if no wallet has been registered for the given blockchain', async () => {
      await expect(wdkManager.getAccountByPath('ethereum', "0'/0/0"))
        .rejects.toThrow('No wallet registered for blockchain: ethereum.')
    })

    describe('should decorate the account instance with', () => {
      describe('getSwapProtocol', () => {
        const SWAP_CONFIG = { swapMaxFee: 100 }

        let SwapProtocolMock

        beforeEach(() => {
          SwapProtocolMock = jest.fn()

          Object.setPrototypeOf(SwapProtocolMock.prototype, SwapProtocol.prototype)
        })

        test("should return the swap protocol registered for the account's blockchain and the given label", async () => {
          wdkManager.registerWallet('ethereum', WalletManagerMock, CONFIG)
                    .registerProtocol('ethereum', 'test', SwapProtocolMock, SWAP_CONFIG)

          const account = await wdkManager.getAccountByPath('ethereum', "0'/0/0")

          const protocol = account.getSwapProtocol('test')

          expect(SwapProtocolMock).toHaveBeenCalledWith(account, SWAP_CONFIG)

          expect(protocol).toBeInstanceOf(SwapProtocolMock)
        })

        test('should return the swap protocol registered for the account and the given label', async () => {
          wdkManager.registerWallet('ethereum', WalletManagerMock, CONFIG)

          const account = await wdkManager.getAccountByPath('ethereum', "0'/0/0")

          account.registerProtocol('test', SwapProtocolMock, SWAP_CONFIG)

          const protocol = account.getSwapProtocol('test')

          expect(SwapProtocolMock).toHaveBeenCalledWith(account, SWAP_CONFIG)

          expect(protocol).toBeInstanceOf(SwapProtocolMock)
        })

        test('should throw if no swap protocol has been registered for the given label', async () => {
          wdkManager.registerWallet('ethereum', WalletManagerMock, CONFIG)

          const account = await wdkManager.getAccountByPath('ethereum', "0'/0/0")

          expect(() => account.getSwapProtocol('test'))
            .toThrow('No swap protocol registered for label: test.')
        })
      })

      describe('getBridgeProtocol', () => {
        const BRIDGE_CONFIG = { bridgeMaxFee: 100 }

        let BridgeProtocolMock

        beforeEach(() => {
          BridgeProtocolMock = jest.fn()

          Object.setPrototypeOf(BridgeProtocolMock.prototype, BridgeProtocol.prototype)
        })

        test("should return the bridge protocol registered for the account's blockchain and the given label", async () => {
          wdkManager.registerWallet('ethereum', WalletManagerMock, CONFIG)
                    .registerProtocol('ethereum', 'test', BridgeProtocolMock, BRIDGE_CONFIG)

          const account = await wdkManager.getAccountByPath('ethereum', "0'/0/0")

          const protocol = account.getBridgeProtocol('test')

          expect(BridgeProtocolMock).toHaveBeenCalledWith(account, BRIDGE_CONFIG)

          expect(protocol).toBeInstanceOf(BridgeProtocolMock)
        })

        test('should return the bridge protocol registered for the account and the given label', async () => {
          wdkManager.registerWallet('ethereum', WalletManagerMock, CONFIG)

          const account = await wdkManager.getAccountByPath('ethereum', "0'/0/0")

          account.registerProtocol('test', BridgeProtocolMock, BRIDGE_CONFIG)

          const protocol = account.getBridgeProtocol('test')

          expect(BridgeProtocolMock).toHaveBeenCalledWith(account, BRIDGE_CONFIG)

          expect(protocol).toBeInstanceOf(BridgeProtocolMock)
        })

        test('should throw if no bridge protocol has been registered for the given label', async () => {
          wdkManager.registerWallet('ethereum', WalletManagerMock, CONFIG)

          const account = await wdkManager.getAccountByPath('ethereum', "0'/0/0")

          expect(() => account.getBridgeProtocol('test'))
            .toThrow('No bridge protocol registered for label: test.')
        })
      })

      describe('getLendingProtocol', () => {
        let LendingProtocolMock

        beforeEach(() => {
          LendingProtocolMock = jest.fn()

          Object.setPrototypeOf(LendingProtocolMock.prototype, LendingProtocol.prototype)
        })

        test("should return the lending protocol registered for the account's blockchain and the given label", async () => {
          wdkManager.registerWallet('ethereum', WalletManagerMock, CONFIG)
                    .registerProtocol('ethereum', 'test', LendingProtocolMock, undefined)

          const account = await wdkManager.getAccountByPath('ethereum', "0'/0/0")

          const protocol = account.getLendingProtocol('test')

          expect(LendingProtocolMock).toHaveBeenCalledWith(account, undefined)

          expect(protocol).toBeInstanceOf(LendingProtocolMock)
        })

        test('should return the lending protocol registered for the account and the given label', async () => {
          wdkManager.registerWallet('ethereum', WalletManagerMock, CONFIG)

          const account = await wdkManager.getAccountByPath('ethereum', "0'/0/0")

          account.registerProtocol('test', LendingProtocolMock, undefined)

          const protocol = account.getLendingProtocol('test')

          expect(LendingProtocolMock).toHaveBeenCalledWith(account, undefined)

          expect(protocol).toBeInstanceOf(LendingProtocolMock)
        })

        test('should throw if no lending protocol has been registered for the given label', async () => {
          wdkManager.registerWallet('ethereum', WalletManagerMock, CONFIG)

          const account = await wdkManager.getAccountByPath('ethereum', "0'/0/0")

          expect(() => account.getLendingProtocol('test'))
            .toThrow('No lending protocol registered for label: test.')
        })
      })
    })
  })

  describe('getFeeRates', () => {
    test('should return the correct fee rates for the given blockchain', async () => {
      const DUMMY_FEE_RATES = { normal: 100n, fast: 200n }

      getFeeRatesMock.mockResolvedValue(DUMMY_FEE_RATES)

      wdkManager.registerWallet('ethereum', WalletManagerMock, CONFIG)

      const feeRates = await wdkManager.getFeeRates('ethereum')

      expect(feeRates).toEqual(DUMMY_FEE_RATES)
    })

    test('should throw if no wallet has been registered for the given blockchain', async () => {
      await expect(wdkManager.getFeeRates('ethereum'))
        .rejects.toThrow('No wallet registered for blockchain: ethereum.')
    })
  })

  describe('dispose', () => {
    beforeEach(() => {
      disposeMock.mockClear()
      mockWcHandler.dispose.mockClear()
    })

    test('should dispose all wallets when called without arguments', () => {
      wdkManager.registerWallet('ethereum', WalletManagerMock, CONFIG)
      wdkManager.registerWallet('bitcoin', WalletManagerMock, CONFIG)

      wdkManager.dispose()

      expect(disposeMock).toHaveBeenCalledTimes(2)
      expect(mockWcHandler.dispose).toHaveBeenCalled()
    })

    test('should dispose only the specified wallets', () => {
      wdkManager.registerWallet('ethereum', WalletManagerMock, CONFIG)
      wdkManager.registerWallet('bitcoin', WalletManagerMock, CONFIG)

      wdkManager.dispose(['ethereum'])

      expect(disposeMock).toHaveBeenCalledTimes(1)
    })

    test('should unregister the wallet after disposal', async () => {
      wdkManager.registerWallet('ethereum', WalletManagerMock, CONFIG)

      wdkManager.dispose(['ethereum'])

      await expect(wdkManager.getAccount('ethereum', 0))
        .rejects.toThrow('No wallet registered for blockchain: ethereum.')
    })

    test('should not affect wallets not in the list', async () => {
      getAccountMock.mockResolvedValue(DUMMY_ACCOUNT)

      wdkManager.registerWallet('ethereum', WalletManagerMock, CONFIG)
      wdkManager.registerWallet('bitcoin', WalletManagerMock, CONFIG)

      wdkManager.dispose(['bitcoin'])

      expect(disposeMock).toHaveBeenCalledTimes(1)
      await expect(wdkManager.getAccount('ethereum', 0)).resolves.toEqual(DUMMY_ACCOUNT)
    })

    test('should be a no-op when given an empty array', () => {
      wdkManager.registerWallet('ethereum', WalletManagerMock, CONFIG)

      wdkManager.dispose([])

      expect(disposeMock).not.toHaveBeenCalled()
    })
  })

  describe('WalletConnect', () => {
    const WC_CONFIG = {
      projectId: 'test-project-id',
      metadata: { name: 'Test', description: 'Test', url: 'https://test.com', icons: [] }
    }

    beforeEach(() => {
      jest.clearAllMocks()
    })

    test('initWalletConnect should delegate to handler and return wdk instance', async () => {
      const result = await wdkManager.initWalletConnect(WC_CONFIG)

      expect(mockWcHandler.init).toHaveBeenCalledWith(WC_CONFIG)
      expect(result).toBe(wdkManager)
    })

    test('walletkit getter should delegate to handler', () => {
      mockWcHandler.walletkit = { mock: true }
      expect(wdkManager.walletkit).toEqual({ mock: true })
    })

    test('pair should delegate to handler', async () => {
      await wdkManager.pair('wc:test-uri')

      expect(mockWcHandler.pair).toHaveBeenCalledWith('wc:test-uri')
    })

    test('approveSession should delegate to handler', async () => {
      const params = { id: 1, namespaces: {} }

      await wdkManager.approveSession(params)

      expect(mockWcHandler.approveSession).toHaveBeenCalledWith(params)
    })

    test('rejectSession should delegate to handler', async () => {
      await wdkManager.rejectSession(1)

      expect(mockWcHandler.rejectSession).toHaveBeenCalledWith(1)
    })

    test('respondRequest should delegate to handler', async () => {
      await wdkManager.respondRequest(1, 'topic', { result: '0xsig' })

      expect(mockWcHandler.respondRequest).toHaveBeenCalledWith(1, 'topic', { result: '0xsig' })
    })

    test('rejectRequest should delegate to handler', async () => {
      await wdkManager.rejectRequest(1, 'topic', 'error')

      expect(mockWcHandler.rejectRequest).toHaveBeenCalledWith(1, 'topic', 'error')
    })

    test('getSessions should delegate to handler', () => {
      const sessions = { 'topic-1': {} }
      mockWcHandler.getSessions.mockReturnValue(sessions)

      expect(wdkManager.getSessions()).toBe(sessions)
    })

    test('disconnectSession should delegate to handler', async () => {
      await wdkManager.disconnectSession('topic-1')

      expect(mockWcHandler.disconnectSession).toHaveBeenCalledWith('topic-1')
    })

    test('updateSession should delegate to handler', async () => {
      const params = { topic: 'topic-1', namespaces: {} }

      await wdkManager.updateSession(params)

      expect(mockWcHandler.updateSession).toHaveBeenCalledWith(params)
    })

    test('emitSessionEvent should delegate to handler', async () => {
      const params = { topic: 'topic-1', event: {}, chainId: 'eip155:1' }

      await wdkManager.emitSessionEvent(params)

      expect(mockWcHandler.emitSessionEvent).toHaveBeenCalledWith(params)
    })

    test('pay should return handler pay client', () => {
      expect(wdkManager.pay).toBe(mockWcHandler.pay)
    })
  })
})
