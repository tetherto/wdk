'use strict'

import { beforeEach, describe, expect, jest, test } from '@jest/globals'

import WalletManager from '@tetherto/wdk-wallet'

import { BridgeProtocol, LendingProtocol, SdaProtocol, SwapProtocol, SwidgeProtocol } from '@tetherto/wdk-wallet/protocols'

import WDK from '../index.js'

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

describe('WDK', () => {
  const DUMMY_ACCOUNT = {
    getAddress: async () => {
      return '0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd'
    }
  }

  const CONFIG = { transferMaxFee: 100, transactionMaxFee: 500 }

  let wdk

  beforeEach(() => {
    wdk = new WDK(SEED_PHRASE)
  })

  describe('isValidSeed', () => {
    test('accepts raw seeds whose length is a multiple of 32 bits', () => {
      expect(WDK.isValidSeed(new Uint8Array(16))).toBe(true)
      expect(WDK.isValidSeed(new Uint8Array(20))).toBe(true)
      expect(WDK.isValidSeed(new Uint8Array(64))).toBe(true)
    })

    test('rejects raw seeds whose length is not a multiple of 32 bits', () => {
      expect(WDK.isValidSeed(new Uint8Array(17))).toBe(false)
      expect(WDK.isValidSeed(new Uint8Array(63))).toBe(false)
      expect(WDK.isValidSeed(new Uint8Array(15))).toBe(false)
      expect(WDK.isValidSeed(new Uint8Array(65))).toBe(false)
    })
  })

  describe('getAccount', () => {
    beforeEach(() => {
      getAccountMock.mockResolvedValue(DUMMY_ACCOUNT)
    })

    test('should return the account at the given index', async () => {
      wdk.registerWallet('ethereum', WalletManagerMock, CONFIG)

      const account = await wdk.getAccount('ethereum', 0)

      expect(WalletManagerMock).toHaveBeenCalledWith(SEED_PHRASE, CONFIG)

      expect(getAccountMock).toHaveBeenCalledWith(0)

      expect(account).toEqual(DUMMY_ACCOUNT)
    })

    test('should trigger middlewares', async () => {
      const middleware = jest.fn()

      wdk.registerWallet('ethereum', WalletManagerMock, CONFIG)
                .registerMiddleware('ethereum', middleware)

      const account = await wdk.getAccount('ethereum', 0)

      expect(middleware).toHaveBeenCalledWith(DUMMY_ACCOUNT)

      expect(account).toEqual(DUMMY_ACCOUNT)
    })

    test('should throw if no wallet has been registered for the given blockchain', async () => {
      await expect(wdk.getAccount('ethereum', 0))
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
          wdk.registerWallet('ethereum', WalletManagerMock, CONFIG)
                    .registerProtocol('ethereum', 'test', SwapProtocolMock, SWAP_CONFIG)

          const account = await wdk.getAccount('ethereum', 0)

          const protocol = account.getSwapProtocol('test')

          expect(SwapProtocolMock).toHaveBeenCalledWith(account, SWAP_CONFIG)

          expect(protocol).toBeInstanceOf(SwapProtocolMock)
        })

        test('should return the swap protocol registered for the account and the given label', async () => {
          wdk.registerWallet('ethereum', WalletManagerMock, CONFIG)

          const account = await wdk.getAccount('ethereum', 0)

          account.registerProtocol('test', SwapProtocolMock, SWAP_CONFIG)

          const protocol = account.getSwapProtocol('test')

          expect(SwapProtocolMock).toHaveBeenCalledWith(account, SWAP_CONFIG)

          expect(protocol).toBeInstanceOf(SwapProtocolMock)
        })

        test('should throw if no swap protocol has been registered for the given label', async () => {
          wdk.registerWallet('ethereum', WalletManagerMock, CONFIG)

          const account = await wdk.getAccount('ethereum', 0)

          expect(() => account.getSwapProtocol('test'))
            .toThrow('No swap protocol registered for label: test.')
        })

        test('should preserve account-scoped protocols across repeated getAccount calls', async () => {
          wdk.registerWallet('ethereum', WalletManagerMock, CONFIG)

          const account = await wdk.getAccount('ethereum', 0)
          account.registerProtocol('test', SwapProtocolMock, SWAP_CONFIG)

          const sameAccount = await wdk.getAccount('ethereum', 0)

          expect(sameAccount.getSwapProtocol('test')).toBeInstanceOf(SwapProtocolMock)
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
          wdk.registerWallet('ethereum', WalletManagerMock, CONFIG)
                    .registerProtocol('ethereum', 'test', BridgeProtocolMock, BRIDGE_CONFIG)

          const account = await wdk.getAccount('ethereum', 0)

          const protocol = account.getBridgeProtocol('test')

          expect(BridgeProtocolMock).toHaveBeenCalledWith(account, BRIDGE_CONFIG)

          expect(protocol).toBeInstanceOf(BridgeProtocolMock)
        })

        test('should return the bridge protocol registered for the account and the given label', async () => {
          wdk.registerWallet('ethereum', WalletManagerMock, CONFIG)

          const account = await wdk.getAccount('ethereum', 0)

          account.registerProtocol('test', BridgeProtocolMock, BRIDGE_CONFIG)

          const protocol = account.getBridgeProtocol('test')

          expect(BridgeProtocolMock).toHaveBeenCalledWith(account, BRIDGE_CONFIG)

          expect(protocol).toBeInstanceOf(BridgeProtocolMock)
        })

        test('should throw if no bridge protocol has been registered for the given label', async () => {
          wdk.registerWallet('ethereum', WalletManagerMock, CONFIG)

          const account = await wdk.getAccount('ethereum', 0)

          expect(() => account.getBridgeProtocol('test'))
            .toThrow('No bridge protocol registered for label: test.')
        })

        test('should preserve account-scoped protocols across repeated getAccount calls', async () => {
          wdk.registerWallet('ethereum', WalletManagerMock, CONFIG)

          const account = await wdk.getAccount('ethereum', 0)
          account.registerProtocol('test', BridgeProtocolMock, BRIDGE_CONFIG)

          const sameAccount = await wdk.getAccount('ethereum', 0)

          expect(sameAccount.getBridgeProtocol('test')).toBeInstanceOf(BridgeProtocolMock)
        })
      })

      describe('getLendingProtocol', () => {
        let LendingProtocolMock

        beforeEach(() => {
          LendingProtocolMock = jest.fn()

          Object.setPrototypeOf(LendingProtocolMock.prototype, LendingProtocol.prototype)
        })

        test("should return the lending protocol registered for the account's blockchain and the given label", async () => {
          wdk.registerWallet('ethereum', WalletManagerMock, CONFIG)
                    .registerProtocol('ethereum', 'test', LendingProtocolMock, undefined)

          const account = await wdk.getAccount('ethereum', 0)

          const protocol = account.getLendingProtocol('test')

          expect(LendingProtocolMock).toHaveBeenCalledWith(account, undefined)

          expect(protocol).toBeInstanceOf(LendingProtocolMock)
        })

        test('should return the lending protocol registered for the account and the given label', async () => {
          wdk.registerWallet('ethereum', WalletManagerMock, CONFIG)

          const account = await wdk.getAccount('ethereum', 0)

          account.registerProtocol('test', LendingProtocolMock, undefined)

          const protocol = account.getLendingProtocol('test')

          expect(LendingProtocolMock).toHaveBeenCalledWith(account, undefined)

          expect(protocol).toBeInstanceOf(LendingProtocolMock)
        })

        test('should throw if no lending protocol has been registered for the given label', async () => {
          wdk.registerWallet('ethereum', WalletManagerMock, CONFIG)

          const account = await wdk.getAccount('ethereum', 0)

          expect(() => account.getLendingProtocol('test'))
            .toThrow('No lending protocol registered for label: test.')
        })

        test('should preserve account-scoped protocols across repeated getAccount calls', async () => {
          wdk.registerWallet('ethereum', WalletManagerMock, CONFIG)

          const account = await wdk.getAccount('ethereum', 0)
          account.registerProtocol('test', LendingProtocolMock, undefined)

          const sameAccount = await wdk.getAccount('ethereum', 0)

          expect(sameAccount.getLendingProtocol('test')).toBeInstanceOf(LendingProtocolMock)
        })
      })

      describe('getSwidgeProtocol', () => {
        const SWIDGE_CONFIG = { maxNetworkFeeBps: 100 }

        let SwidgeProtocolMock

        beforeEach(() => {
          SwidgeProtocolMock = jest.fn()

          Object.setPrototypeOf(SwidgeProtocolMock.prototype, SwidgeProtocol.prototype)
        })

        test("should return the swidge protocol registered for the account's blockchain and the given label", async () => {
          wdk.registerWallet('ethereum', WalletManagerMock, CONFIG)
                    .registerProtocol('ethereum', 'test', SwidgeProtocolMock, SWIDGE_CONFIG)

          const account = await wdk.getAccount('ethereum', 0)

          const protocol = account.getSwidgeProtocol('test')

          expect(SwidgeProtocolMock).toHaveBeenCalledWith(account, SWIDGE_CONFIG)

          expect(protocol).toBeInstanceOf(SwidgeProtocolMock)
        })

        test('should return the swidge protocol registered for the account and the given label', async () => {
          wdk.registerWallet('ethereum', WalletManagerMock, CONFIG)

          const account = await wdk.getAccount('ethereum', 0)

          account.registerProtocol('test', SwidgeProtocolMock, SWIDGE_CONFIG)

          const protocol = account.getSwidgeProtocol('test')

          expect(SwidgeProtocolMock).toHaveBeenCalledWith(account, SWIDGE_CONFIG)

          expect(protocol).toBeInstanceOf(SwidgeProtocolMock)
        })

        test('should throw if no swidge protocol has been registered for the given label', async () => {
          wdk.registerWallet('ethereum', WalletManagerMock, CONFIG)

          const account = await wdk.getAccount('ethereum', 0)

          expect(() => account.getSwidgeProtocol('test'))
            .toThrow('No swidge protocol registered for label: test.')
        })

        test('should preserve account-scoped protocols across repeated getAccount calls', async () => {
          wdk.registerWallet('ethereum', WalletManagerMock, CONFIG)

          const account = await wdk.getAccount('ethereum', 0)
          account.registerProtocol('test', SwidgeProtocolMock, SWIDGE_CONFIG)

          const sameAccount = await wdk.getAccount('ethereum', 0)

          expect(sameAccount.getSwidgeProtocol('test')).toBeInstanceOf(SwidgeProtocolMock)
        })
      })

      describe('getSdaProtocol', () => {
        const SDA_CONFIG = { apiKey: 'dummy-key' }

        let SdaProtocolMock

        beforeEach(() => {
          SdaProtocolMock = jest.fn()

          Object.setPrototypeOf(SdaProtocolMock.prototype, SdaProtocol.prototype)
        })

        test("should return the sda protocol registered for the account's blockchain and the given label", async () => {
          wdk.registerWallet('ethereum', WalletManagerMock, CONFIG)
                    .registerProtocol('ethereum', 'test', SdaProtocolMock, SDA_CONFIG)

          const account = await wdk.getAccount('ethereum', 0)

          const protocol = account.getSdaProtocol('test')

          expect(SdaProtocolMock).toHaveBeenCalledWith(account, SDA_CONFIG)

          expect(protocol).toBeInstanceOf(SdaProtocolMock)
        })

        test('should return the sda protocol registered for the account and the given label', async () => {
          wdk.registerWallet('ethereum', WalletManagerMock, CONFIG)

          const account = await wdk.getAccount('ethereum', 0)

          account.registerProtocol('test', SdaProtocolMock, SDA_CONFIG)

          const protocol = account.getSdaProtocol('test')

          expect(SdaProtocolMock).toHaveBeenCalledWith(account, SDA_CONFIG)

          expect(protocol).toBeInstanceOf(SdaProtocolMock)
        })

        test('should throw if no sda protocol has been registered for the given label', async () => {
          wdk.registerWallet('ethereum', WalletManagerMock, CONFIG)

          const account = await wdk.getAccount('ethereum', 0)

          expect(() => account.getSdaProtocol('test'))
            .toThrow('No sda protocol registered for label: test.')
        })

        test('should preserve account-scoped protocols across repeated getAccount calls', async () => {
          wdk.registerWallet('ethereum', WalletManagerMock, CONFIG)

          const account = await wdk.getAccount('ethereum', 0)
          account.registerProtocol('test', SdaProtocolMock, SDA_CONFIG)

          const sameAccount = await wdk.getAccount('ethereum', 0)

          expect(sameAccount.getSdaProtocol('test')).toBeInstanceOf(SdaProtocolMock)
        })
      })
    })
  })

  describe('getAccountByPath', () => {
    beforeEach(() => {
      getAccountByPathMock.mockResolvedValue(DUMMY_ACCOUNT)
    })

    test('should return the account at the given path', async () => {
      wdk.registerWallet('ethereum', WalletManagerMock, CONFIG)

      const account = await wdk.getAccountByPath('ethereum', "0'/0/0")

      expect(WalletManagerMock).toHaveBeenCalledWith(SEED_PHRASE, CONFIG)

      expect(getAccountByPathMock).toHaveBeenCalledWith("0'/0/0")

      expect(account).toEqual(DUMMY_ACCOUNT)
    })

    test('should trigger middlewares', async () => {
      const middleware = jest.fn()

      wdk.registerWallet('ethereum', WalletManagerMock, CONFIG)
                .registerMiddleware('ethereum', middleware)

      const account = await wdk.getAccountByPath('ethereum', "0'/0/0")

      expect(middleware).toHaveBeenCalledWith(DUMMY_ACCOUNT)

      expect(account).toEqual(DUMMY_ACCOUNT)
    })

    test('should throw if no wallet has been registered for the given blockchain', async () => {
      await expect(wdk.getAccountByPath('ethereum', "0'/0/0"))
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
          wdk.registerWallet('ethereum', WalletManagerMock, CONFIG)
                    .registerProtocol('ethereum', 'test', SwapProtocolMock, SWAP_CONFIG)

          const account = await wdk.getAccountByPath('ethereum', "0'/0/0")

          const protocol = account.getSwapProtocol('test')

          expect(SwapProtocolMock).toHaveBeenCalledWith(account, SWAP_CONFIG)

          expect(protocol).toBeInstanceOf(SwapProtocolMock)
        })

        test('should return the swap protocol registered for the account and the given label', async () => {
          wdk.registerWallet('ethereum', WalletManagerMock, CONFIG)

          const account = await wdk.getAccountByPath('ethereum', "0'/0/0")

          account.registerProtocol('test', SwapProtocolMock, SWAP_CONFIG)

          const protocol = account.getSwapProtocol('test')

          expect(SwapProtocolMock).toHaveBeenCalledWith(account, SWAP_CONFIG)

          expect(protocol).toBeInstanceOf(SwapProtocolMock)
        })

        test('should throw if no swap protocol has been registered for the given label', async () => {
          wdk.registerWallet('ethereum', WalletManagerMock, CONFIG)

          const account = await wdk.getAccountByPath('ethereum', "0'/0/0")

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
          wdk.registerWallet('ethereum', WalletManagerMock, CONFIG)
                    .registerProtocol('ethereum', 'test', BridgeProtocolMock, BRIDGE_CONFIG)

          const account = await wdk.getAccountByPath('ethereum', "0'/0/0")

          const protocol = account.getBridgeProtocol('test')

          expect(BridgeProtocolMock).toHaveBeenCalledWith(account, BRIDGE_CONFIG)

          expect(protocol).toBeInstanceOf(BridgeProtocolMock)
        })

        test('should return the bridge protocol registered for the account and the given label', async () => {
          wdk.registerWallet('ethereum', WalletManagerMock, CONFIG)

          const account = await wdk.getAccountByPath('ethereum', "0'/0/0")

          account.registerProtocol('test', BridgeProtocolMock, BRIDGE_CONFIG)

          const protocol = account.getBridgeProtocol('test')

          expect(BridgeProtocolMock).toHaveBeenCalledWith(account, BRIDGE_CONFIG)

          expect(protocol).toBeInstanceOf(BridgeProtocolMock)
        })

        test('should throw if no bridge protocol has been registered for the given label', async () => {
          wdk.registerWallet('ethereum', WalletManagerMock, CONFIG)

          const account = await wdk.getAccountByPath('ethereum', "0'/0/0")

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
          wdk.registerWallet('ethereum', WalletManagerMock, CONFIG)
                    .registerProtocol('ethereum', 'test', LendingProtocolMock, undefined)

          const account = await wdk.getAccountByPath('ethereum', "0'/0/0")

          const protocol = account.getLendingProtocol('test')

          expect(LendingProtocolMock).toHaveBeenCalledWith(account, undefined)

          expect(protocol).toBeInstanceOf(LendingProtocolMock)
        })

        test('should return the lending protocol registered for the account and the given label', async () => {
          wdk.registerWallet('ethereum', WalletManagerMock, CONFIG)

          const account = await wdk.getAccountByPath('ethereum', "0'/0/0")

          account.registerProtocol('test', LendingProtocolMock, undefined)

          const protocol = account.getLendingProtocol('test')

          expect(LendingProtocolMock).toHaveBeenCalledWith(account, undefined)

          expect(protocol).toBeInstanceOf(LendingProtocolMock)
        })

        test('should throw if no lending protocol has been registered for the given label', async () => {
          wdk.registerWallet('ethereum', WalletManagerMock, CONFIG)

          const account = await wdk.getAccountByPath('ethereum', "0'/0/0")

          expect(() => account.getLendingProtocol('test'))
            .toThrow('No lending protocol registered for label: test.')
        })
      })

      describe('getSwidgeProtocol', () => {
        const SWIDGE_CONFIG = { maxNetworkFeeBps: 100 }

        let SwidgeProtocolMock

        beforeEach(() => {
          SwidgeProtocolMock = jest.fn()

          Object.setPrototypeOf(SwidgeProtocolMock.prototype, SwidgeProtocol.prototype)
        })

        test("should return the swidge protocol registered for the account's blockchain and the given label", async () => {
          wdk.registerWallet('ethereum', WalletManagerMock, CONFIG)
                    .registerProtocol('ethereum', 'test', SwidgeProtocolMock, SWIDGE_CONFIG)

          const account = await wdk.getAccountByPath('ethereum', "0'/0/0")

          const protocol = account.getSwidgeProtocol('test')

          expect(SwidgeProtocolMock).toHaveBeenCalledWith(account, SWIDGE_CONFIG)

          expect(protocol).toBeInstanceOf(SwidgeProtocolMock)
        })

        test('should return the swidge protocol registered for the account and the given label', async () => {
          wdk.registerWallet('ethereum', WalletManagerMock, CONFIG)

          const account = await wdk.getAccountByPath('ethereum', "0'/0/0")

          account.registerProtocol('test', SwidgeProtocolMock, SWIDGE_CONFIG)

          const protocol = account.getSwidgeProtocol('test')

          expect(SwidgeProtocolMock).toHaveBeenCalledWith(account, SWIDGE_CONFIG)

          expect(protocol).toBeInstanceOf(SwidgeProtocolMock)
        })

        test('should throw if no swidge protocol has been registered for the given label', async () => {
          wdk.registerWallet('ethereum', WalletManagerMock, CONFIG)

          const account = await wdk.getAccountByPath('ethereum', "0'/0/0")

          expect(() => account.getSwidgeProtocol('test'))
            .toThrow('No swidge protocol registered for label: test.')
        })
      })

      describe('getSdaProtocol', () => {
        const SDA_CONFIG = { apiKey: 'dummy-key' }

        let SdaProtocolMock

        beforeEach(() => {
          SdaProtocolMock = jest.fn()

          Object.setPrototypeOf(SdaProtocolMock.prototype, SdaProtocol.prototype)
        })

        test("should return the sda protocol registered for the account's blockchain and the given label", async () => {
          wdk.registerWallet('ethereum', WalletManagerMock, CONFIG)
                    .registerProtocol('ethereum', 'test', SdaProtocolMock, SDA_CONFIG)

          const account = await wdk.getAccountByPath('ethereum', "0'/0/0")

          const protocol = account.getSdaProtocol('test')

          expect(SdaProtocolMock).toHaveBeenCalledWith(account, SDA_CONFIG)

          expect(protocol).toBeInstanceOf(SdaProtocolMock)
        })

        test('should return the sda protocol registered for the account and the given label', async () => {
          wdk.registerWallet('ethereum', WalletManagerMock, CONFIG)

          const account = await wdk.getAccountByPath('ethereum', "0'/0/0")

          account.registerProtocol('test', SdaProtocolMock, SDA_CONFIG)

          const protocol = account.getSdaProtocol('test')

          expect(SdaProtocolMock).toHaveBeenCalledWith(account, SDA_CONFIG)

          expect(protocol).toBeInstanceOf(SdaProtocolMock)
        })

        test('should throw if no sda protocol has been registered for the given label', async () => {
          wdk.registerWallet('ethereum', WalletManagerMock, CONFIG)

          const account = await wdk.getAccountByPath('ethereum', "0'/0/0")

          expect(() => account.getSdaProtocol('test'))
            .toThrow('No sda protocol registered for label: test.')
        })
      })
    })
  })

  describe('registerWallet', () => {
    test('should throw if a wallet is already registered for the given blockchain', () => {
      wdk.registerWallet('ethereum', WalletManagerMock, CONFIG)

      expect(() => wdk.registerWallet('ethereum', WalletManagerMock, CONFIG))
        .toThrow('A wallet is already registered for blockchain: ethereum. Call dispose(["ethereum"]) before re-registering.')
    })

    test('should allow re-registering after dispose', () => {
      wdk.registerWallet('ethereum', WalletManagerMock, CONFIG)
      wdk.dispose(['ethereum'])

      expect(wdk.registerWallet('ethereum', WalletManagerMock, CONFIG)).toBe(wdk)
    })
  })

  describe('getFeeRates', () => {
    test('should return the correct fee rates for the given blockchain', async () => {
      const DUMMY_FEE_RATES = { normal: 100n, fast: 200n }

      getFeeRatesMock.mockResolvedValue(DUMMY_FEE_RATES)

      wdk.registerWallet('ethereum', WalletManagerMock, CONFIG)

      const feeRates = await wdk.getFeeRates('ethereum')

      expect(feeRates).toEqual(DUMMY_FEE_RATES)
    })

    test('should throw if no wallet has been registered for the given blockchain', async () => {
      await expect(wdk.getFeeRates('ethereum'))
        .rejects.toThrow('No wallet registered for blockchain: ethereum.')
    })
  })

  describe('dispose', () => {
    beforeEach(() => {
      disposeMock.mockClear()
    })

    test('should dispose all wallets when called without arguments', () => {
      wdk.registerWallet('ethereum', WalletManagerMock, CONFIG)
      wdk.registerWallet('bitcoin', WalletManagerMock, CONFIG)

      wdk.dispose()

      expect(disposeMock).toHaveBeenCalledTimes(2)
    })

    test('should dispose only the specified wallets', () => {
      wdk.registerWallet('ethereum', WalletManagerMock, CONFIG)
      wdk.registerWallet('bitcoin', WalletManagerMock, CONFIG)

      wdk.dispose(['ethereum'])

      expect(disposeMock).toHaveBeenCalledTimes(1)
    })

    test('should unregister the wallet after disposal', async () => {
      wdk.registerWallet('ethereum', WalletManagerMock, CONFIG)

      wdk.dispose(['ethereum'])

      await expect(wdk.getAccount('ethereum', 0))
        .rejects.toThrow('No wallet registered for blockchain: ethereum.')
    })

    test('should not affect wallets not in the list', async () => {
      getAccountMock.mockResolvedValue(DUMMY_ACCOUNT)

      wdk.registerWallet('ethereum', WalletManagerMock, CONFIG)
      wdk.registerWallet('bitcoin', WalletManagerMock, CONFIG)

      wdk.dispose(['bitcoin'])

      expect(disposeMock).toHaveBeenCalledTimes(1)
      await expect(wdk.getAccount('ethereum', 0)).resolves.toEqual(DUMMY_ACCOUNT)
    })

    test('should be a no-op when given an empty array', () => {
      wdk.registerWallet('ethereum', WalletManagerMock, CONFIG)

      wdk.dispose([])

      expect(disposeMock).not.toHaveBeenCalled()
    })
  })
})
