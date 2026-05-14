'use strict'

import { beforeEach, describe, expect, jest, test } from '@jest/globals'

import WalletManager from '@tetherto/wdk-wallet'

import { BridgeProtocol, LendingProtocol, SwapProtocol } from '@tetherto/wdk-wallet/protocols'

import WdkManager, { TraceEvents } from '../index.js'

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
    })

    test('should dispose all wallets when called without arguments', () => {
      wdkManager.registerWallet('ethereum', WalletManagerMock, CONFIG)
      wdkManager.registerWallet('bitcoin', WalletManagerMock, CONFIG)

      wdkManager.dispose()

      expect(disposeMock).toHaveBeenCalledTimes(2)
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

  describe('tracer', () => {
    test('should not be invoked when no tracer is configured', () => {
      const wdk = new WdkManager(SEED_PHRASE)

      wdk.registerWallet('ethereum', WalletManagerMock, CONFIG)
      wdk.dispose()

      expect(true).toBe(true)
    })

    test('should emit wdk.created on construction', () => {
      const tracer = jest.fn()

      new WdkManager(SEED_PHRASE, { tracer })

      expect(tracer).toHaveBeenCalledWith(expect.objectContaining({ name: TraceEvents.Created }))
    })

    test('should emit wdk.wallet.registered with blockchain and duration', () => {
      const tracer = jest.fn()
      const wdk = new WdkManager(SEED_PHRASE, { tracer })

      wdk.registerWallet('ethereum', WalletManagerMock, CONFIG)

      const event = tracer.mock.calls.find(([e]) => e.name === TraceEvents.WalletRegistered)?.[0]
      expect(event).toBeDefined()
      expect(event.blockchain).toBe('ethereum')
      expect(typeof event.startedAt).toBe('number')
      expect(typeof event.durationMs).toBe('number')
    })

    test('should emit wdk.account.resolved on success', async () => {
      getAccountMock.mockResolvedValue({ getAddress: async () => '0x0' })

      const tracer = jest.fn()
      const wdk = new WdkManager(SEED_PHRASE, { tracer })
      wdk.registerWallet('ethereum', WalletManagerMock, CONFIG)

      await wdk.getAccount('ethereum', 7)

      const event = tracer.mock.calls.find(([e]) => e.name === TraceEvents.AccountResolved)?.[0]
      expect(event).toBeDefined()
      expect(event.blockchain).toBe('ethereum')
      expect(event.meta).toEqual({ index: 7 })
    })

    test('should emit wdk.account.failed when no wallet is registered', async () => {
      const tracer = jest.fn()
      const wdk = new WdkManager(SEED_PHRASE, { tracer })

      await expect(wdk.getAccount('ethereum', 0)).rejects.toThrow()

      const event = tracer.mock.calls.find(([e]) => e.name === TraceEvents.AccountFailed)?.[0]
      expect(event).toBeDefined()
      expect(event.error).toBeInstanceOf(Error)
    })

    test('should emit wdk.middleware.executed for each middleware run', async () => {
      getAccountMock.mockResolvedValue({ getAddress: async () => '0x0' })

      const tracer = jest.fn()
      const wdk = new WdkManager(SEED_PHRASE, { tracer })
      wdk.registerWallet('ethereum', WalletManagerMock, CONFIG)
                .registerMiddleware('ethereum', async () => {})
                .registerMiddleware('ethereum', async () => {})

      await wdk.getAccount('ethereum', 0)

      const events = tracer.mock.calls.filter(([e]) => e.name === TraceEvents.MiddlewareExecuted)
      expect(events).toHaveLength(2)
    })

    test('should emit wdk.middleware.failed and re-throw when a middleware rejects', async () => {
      getAccountMock.mockResolvedValue({ getAddress: async () => '0x0' })

      const tracer = jest.fn()
      const wdk = new WdkManager(SEED_PHRASE, { tracer })
      const boom = new Error('boom')
      wdk.registerWallet('ethereum', WalletManagerMock, CONFIG)
                .registerMiddleware('ethereum', async () => { throw boom })

      await expect(wdk.getAccount('ethereum', 0)).rejects.toBe(boom)

      const event = tracer.mock.calls.find(([e]) => e.name === TraceEvents.MiddlewareFailed)?.[0]
      expect(event).toBeDefined()
      expect(event.error).toBe(boom)
    })

    test('should not propagate errors thrown by the tracer itself', () => {
      const tracer = jest.fn(() => { throw new Error('tracer exploded') })

      expect(() => new WdkManager(SEED_PHRASE, { tracer })).not.toThrow()
    })

    test('should ignore non-function tracer values', () => {
      expect(() => new WdkManager(SEED_PHRASE, { tracer: 'not a function' })).not.toThrow()
    })
  })
})
