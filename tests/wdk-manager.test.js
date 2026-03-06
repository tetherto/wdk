'use strict'

import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'

import WalletManager from '@tetherto/wdk-wallet'

import { BridgeProtocol, LendingProtocol, SwapProtocol } from '@tetherto/wdk-wallet/protocols'

import WdkManager from '../index.js'

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
    test('should successfully dispose the wallet managers', async () => {
      wdkManager.registerWallet('ethereum', WalletManagerMock, CONFIG)

      wdkManager.dispose()

      expect(disposeMock).toHaveBeenCalled()
    })
  })

  describe('registerPolicies', () => {
    const ETHEREUM_TEST = 'ethereum-test'
    const ETHEREUM_LOCAL = 'ethereum-local'
    const DUMMY_TX_HASH = '0xdeadbeef1234567890abcdef1234567890abcdef12345678'
    const DUMMY_APPROVE_HASH = '0xaaaa1111bbbb2222cccc3333dddd4444eeee5555ffff6666'
    const DUMMY_TX_FEE = 21_000_000_000_000n
    const DUMMY_BRIDGE_FEE = 5_000_000_000_000n
    const DUMMY_SIGNATURE = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'

    beforeEach(() => {
      getAccountMock.mockReset()
      getAccountMock.mockImplementation(() => ({
        getAddress: async () => '0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd',
        sendTransaction: jest.fn().mockResolvedValue({ hash: DUMMY_TX_HASH, fee: DUMMY_TX_FEE }),
        transfer: jest.fn().mockResolvedValue({ hash: DUMMY_TX_HASH, fee: DUMMY_TX_FEE }),
        bridge: jest.fn().mockResolvedValue({ hash: DUMMY_TX_HASH, approveHash: DUMMY_APPROVE_HASH, fee: DUMMY_TX_FEE, bridgeFee: DUMMY_BRIDGE_FEE }),
        repay: jest.fn().mockResolvedValue({ hash: DUMMY_TX_HASH, fee: DUMMY_TX_FEE }),
        borrow: jest.fn().mockResolvedValue({ hash: DUMMY_TX_HASH, fee: DUMMY_TX_FEE }),
        sign: jest.fn().mockResolvedValue(DUMMY_SIGNATURE)
      }))
    })

    afterEach(() => {
      wdkManager.dispose()
    })

    test('should allow sendTransaction when value is under the global spending limit', async () => {
      const MAX_TRANSFER_VALUE = 10n ** 18n
      const evaluateMaxTransferPolicy = jest.fn(({ params }) => BigInt(params.value ?? 0n) <= MAX_TRANSFER_VALUE)
      const sendParams = { value: 5n * 10n ** 17n }

      wdkManager.registerWallet('ethereum', WalletManagerMock, CONFIG)
      wdkManager.registerPolicies([
        {
          name: 'max-transfer-1eth',
          method: 'sendTransaction',
          evaluate: evaluateMaxTransferPolicy
        }
      ])
      const account = await wdkManager.getAccount('ethereum', 0)

      const result = await account.sendTransaction(sendParams)

      expect(result).toEqual({ hash: DUMMY_TX_HASH, fee: DUMMY_TX_FEE })
      expect(evaluateMaxTransferPolicy).toHaveBeenCalledTimes(1)
      expect(evaluateMaxTransferPolicy).toHaveBeenCalledWith({
        method: 'sendTransaction',
        params: sendParams,
        target: { blockchain: 'ethereum' }
      })
    })

    test('should reject sendTransaction when value is over the global spending limit', async () => {
      const MAX_TRANSFER_VALUE = 10n ** 18n
      const evaluateMaxTransferPolicy = jest.fn(({ params }) => BigInt(params.value ?? 0n) <= MAX_TRANSFER_VALUE)
      const sendParams = { value: 2n * 10n ** 18n }

      wdkManager.registerWallet('ethereum', WalletManagerMock, CONFIG)
      wdkManager.registerPolicies([
        {
          name: 'max-transfer-1eth',
          method: 'sendTransaction',
          evaluate: evaluateMaxTransferPolicy
        }
      ])
      const account = await wdkManager.getAccount('ethereum', 0)

      await expect(account.sendTransaction(sendParams))
        .rejects.toThrow('Policy "max-transfer-1eth" rejected method "sendTransaction" for global')

      expect(evaluateMaxTransferPolicy).toHaveBeenCalledTimes(1)
      expect(evaluateMaxTransferPolicy).toHaveBeenCalledWith({
        method: 'sendTransaction',
        params: sendParams,
        target: { blockchain: 'ethereum' }
      })
    })

    test('should apply a blockchain-targeted policy only to the matching wallet', async () => {
      const evaluateEthereumBridgePolicy = jest.fn(() => false)

      wdkManager.registerWallet(ETHEREUM_TEST, WalletManagerMock, CONFIG)
      wdkManager.registerWallet('ton', WalletManagerMock, CONFIG)
      wdkManager.registerPolicies([
        {
          name: 'ethereum-only-bridge',
          target: { blockchain: ETHEREUM_TEST },
          method: 'bridge',
          evaluate: evaluateEthereumBridgePolicy
        }
      ])
      const ethereumAccount = await wdkManager.getAccount(ETHEREUM_TEST, 0)
      const tonAccount = await wdkManager.getAccount('ton', 0)

      await expect(ethereumAccount.bridge({}))
        .rejects.toThrow('Policy "ethereum-only-bridge" rejected method "bridge" for global')
      const tonBridgeResult = await tonAccount.bridge({})

      expect(tonBridgeResult).toEqual({ hash: DUMMY_TX_HASH, approveHash: DUMMY_APPROVE_HASH, fee: DUMMY_TX_FEE, bridgeFee: DUMMY_BRIDGE_FEE })
      expect(evaluateEthereumBridgePolicy).toHaveBeenCalledTimes(1)
      expect(evaluateEthereumBridgePolicy).toHaveBeenCalledWith({
        method: 'bridge',
        params: {},
        target: { blockchain: ETHEREUM_TEST }
      })
    })

    test('should reject swap when a protocol-targeted policy matches blockchain and label', async () => {
      const SwapProtocolMock = jest.fn()
      Object.setPrototypeOf(SwapProtocolMock.prototype, SwapProtocol.prototype)

      const evaluateSwapPolicy = jest.fn(() => false)
      const swapParams = { tokenIn: 'USDT' }

      wdkManager.registerWallet('ethereum', WalletManagerMock, CONFIG)
      wdkManager.registerProtocol('ethereum', 'mainnet', SwapProtocolMock, { swapMaxFee: 100 })
      wdkManager.registerPolicies([
        {
          name: 'swap-max-fee',
          target: { protocol: { blockchain: 'ethereum', label: 'mainnet' } },
          method: 'swap',
          evaluate: evaluateSwapPolicy
        }
      ])
      const account = await wdkManager.getAccount('ethereum', 0)
      const protocol = account.getSwapProtocol('mainnet')

      await expect(protocol.swap(swapParams))
        .rejects.toThrow('Policy "swap-max-fee" rejected method "swap" for protocol: {"blockchain":"ethereum","label":"mainnet"}')

      expect(evaluateSwapPolicy).toHaveBeenCalledTimes(1)
      expect(evaluateSwapPolicy).toHaveBeenCalledWith({
        method: 'swap',
        params: swapParams,
        target: { protocol: { blockchain: 'ethereum', label: 'mainnet' } }
      })
    })

    test('should apply a multi-method policy to each listed account method', async () => {
      const evaluateDisableCriticalOpsPolicy = jest.fn(() => false)
      const bridgeParams = { route: 'eth-ton' }
      const repayParams = { amount: 1n }
      const borrowParams = { amount: 2n }
      const signParams = { payload: '0xdeadbeef' }

      wdkManager.registerWallet(ETHEREUM_LOCAL, WalletManagerMock, CONFIG)
      wdkManager.registerPolicies([
        {
          name: 'disable-critical-ops',
          target: { blockchain: ETHEREUM_LOCAL },
          method: ['bridge', 'repay', 'borrow'],
          evaluate: evaluateDisableCriticalOpsPolicy
        }
      ])
      const account = await wdkManager.getAccount(ETHEREUM_LOCAL, 0)

      await expect(account.bridge(bridgeParams))
        .rejects.toThrow('Policy "disable-critical-ops" rejected method "bridge" for global')
      await expect(account.repay(repayParams))
        .rejects.toThrow('Policy "disable-critical-ops" rejected method "repay" for global')
      await expect(account.borrow(borrowParams))
        .rejects.toThrow('Policy "disable-critical-ops" rejected method "borrow" for global')
      const signResult = await account.sign(signParams)

      expect(signResult).toBe(DUMMY_SIGNATURE)
      expect(evaluateDisableCriticalOpsPolicy).toHaveBeenCalledTimes(3)
      expect(evaluateDisableCriticalOpsPolicy).toHaveBeenNthCalledWith(1, {
        method: 'bridge',
        params: bridgeParams,
        target: { blockchain: ETHEREUM_LOCAL }
      })
      expect(evaluateDisableCriticalOpsPolicy).toHaveBeenNthCalledWith(2, {
        method: 'repay',
        params: repayParams,
        target: { blockchain: ETHEREUM_LOCAL }
      })
      expect(evaluateDisableCriticalOpsPolicy).toHaveBeenNthCalledWith(3, {
        method: 'borrow',
        params: borrowParams,
        target: { blockchain: ETHEREUM_LOCAL }
      })
    })

    test('should await an async policy before allowing a method call', async () => {
      const evaluateBusinessHoursPolicy = jest.fn().mockResolvedValue(true)
      const signParams = { message: '0xabc' }

      wdkManager.registerWallet('ethereum', WalletManagerMock, CONFIG)
      wdkManager.registerPolicies([
        {
          name: 'business-hours',
          method: 'sign',
          evaluate: evaluateBusinessHoursPolicy
        }
      ])
      const account = await wdkManager.getAccount('ethereum', 0)

      const signResult = await account.sign(signParams)

      expect(signResult).toBe(DUMMY_SIGNATURE)
      expect(evaluateBusinessHoursPolicy).toHaveBeenCalledTimes(1)
      expect(evaluateBusinessHoursPolicy).toHaveBeenCalledWith({
        method: 'sign',
        params: signParams,
        target: { blockchain: 'ethereum' }
      })
    })

    test('should stop evaluating policies after the first policy rejects', async () => {
      const firstPolicyEvaluator = jest.fn(() => false)
      const secondPolicyEvaluator = jest.fn(() => true)

      wdkManager.registerWallet('polygon', WalletManagerMock, CONFIG)
      wdkManager.registerPolicies([
        {
          name: 'p1',
          method: 'sendTransaction',
          evaluate: firstPolicyEvaluator
        },
        {
          name: 'p2',
          method: 'sendTransaction',
          evaluate: secondPolicyEvaluator
        }
      ])
      const account = await wdkManager.getAccount('polygon', 0)

      await expect(account.sendTransaction({}))
        .rejects.toThrow('Policy "p1" rejected method "sendTransaction" for global')

      expect(firstPolicyEvaluator).toHaveBeenCalledTimes(1)
      expect(secondPolicyEvaluator).not.toHaveBeenCalled()
    })

    test('should run a policy without method filter on each called account method', async () => {
      const evaluateGlobalPolicy = jest.fn(() => true)
      const transferParams = { to: '0xaaa', amount: 11n }
      const repayParams = { amount: 22n }
      const borrowParams = { amount: 33n }

      wdkManager.registerWallet('ethereum', WalletManagerMock, CONFIG)
      wdkManager.registerPolicies([
        {
          name: 'global-policy',
          evaluate: evaluateGlobalPolicy
        }
      ])
      const account = await wdkManager.getAccount('ethereum', 0)

      const transferResult = await account.transfer(transferParams)
      const repayResult = await account.repay(repayParams)
      const borrowResult = await account.borrow(borrowParams)

      expect(transferResult).toEqual({ hash: DUMMY_TX_HASH, fee: DUMMY_TX_FEE })
      expect(repayResult).toEqual({ hash: DUMMY_TX_HASH, fee: DUMMY_TX_FEE })
      expect(borrowResult).toEqual({ hash: DUMMY_TX_HASH, fee: DUMMY_TX_FEE })
      expect(evaluateGlobalPolicy).toHaveBeenCalledTimes(3)
      expect(evaluateGlobalPolicy).toHaveBeenNthCalledWith(1, {
        method: 'transfer',
        params: transferParams,
        target: { blockchain: 'ethereum' }
      })
      expect(evaluateGlobalPolicy).toHaveBeenNthCalledWith(2, {
        method: 'repay',
        params: repayParams,
        target: { blockchain: 'ethereum' }
      })
      expect(evaluateGlobalPolicy).toHaveBeenNthCalledWith(3, {
        method: 'borrow',
        params: borrowParams,
        target: { blockchain: 'ethereum' }
      })
    })
  })
})
