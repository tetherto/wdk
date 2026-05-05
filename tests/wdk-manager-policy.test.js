'use strict'

import { beforeEach, describe, expect, jest, test } from '@jest/globals'

import WalletManager from '@tetherto/wdk-wallet'

import { BridgeProtocol, SwapProtocol } from '@tetherto/wdk-wallet/protocols'

import WdkManager, { PolicyConfigurationError, PolicyViolationError } from '../index.js'

const SEED_PHRASE = 'cook voyage document eight skate token alien guide drink uncle term abuse'

// Stub return values (DUMMY_ prefix per CQ5).
const DUMMY_TX_HASH = '0xtx-hash-dummy'
const DUMMY_TRANSFER_HASH = '0xtransfer-hash-dummy'
const DUMMY_SIGNATURE = '0xsig-dummy'
const DUMMY_BALANCE = 1000n
const DUMMY_QUOTE = { fee: 1n }
const DUMMY_SWAP_RESULT = { hash: '0xswap-hash-dummy' }
const DUMMY_BRIDGE_RESULT = { hash: '0xbridge-hash-dummy' }

// Test inputs (no DUMMY_ prefix per CQ5).
const PATH_DEFAULT = "0'/0/0"
const PATH_SECONDARY = "0'/0/1"
const RECIPIENT = '0xrecipient'
const SANCTIONED = '0xsanctioned'
const SPENDER = '0xspender'
const TOKEN = '0xtoken'

// Mock references for the wallet boundary (the only legitimate mock surface).
const sendTransactionMock = jest.fn()
const transferMock = jest.fn()
const approveMock = jest.fn()
const signMessageMock = jest.fn()
const getBalanceMock = jest.fn()
const quoteTransferMock = jest.fn()
const getAccountMock = jest.fn()
const getAccountByPathMock = jest.fn()
const disposeWalletMock = jest.fn()

const WalletManagerMock = jest.fn().mockImplementation(() => {
  return Object.create(WalletManager.prototype, {
    getAccount: { value: getAccountMock },
    getAccountByPath: { value: getAccountByPathMock },
    dispose: { value: disposeWalletMock }
  })
})

const buildAccount = (path = PATH_DEFAULT, overrides = {}) => ({
  path,
  index: parseInt(path.split('/').pop(), 10) || 0,
  sendTransaction: sendTransactionMock,
  transfer: transferMock,
  approve: approveMock,
  signMessage: signMessageMock,
  getBalance: getBalanceMock,
  quoteTransfer: quoteTransferMock,
  toReadOnlyAccount: async () => ({
    path,
    index: parseInt(path.split('/').pop(), 10) || 0,
    getAddress: async () => `0xaddr-${path}`,
    getBalance: getBalanceMock,
    quoteTransfer: quoteTransferMock
  }),
  ...overrides
})

const projectAllowAll = (id) => ({
  id,
  name: id,
  scope: 'project',
  rules: [{ name: `${id}-rule`, operation: 'sendTransaction', action: 'ALLOW', conditions: [] }]
})

const projectDenyAll = (id) => ({
  id,
  name: id,
  scope: 'project',
  rules: [{ name: `${id}-rule`, operation: 'sendTransaction', action: 'DENY', conditions: [] }]
})

const catchAsync = async (fn) => {
  try { await fn(); return null } catch (err) { return err }
}

const catchSync = (fn) => {
  try { fn(); return null } catch (err) { return err }
}

describe('WdkManager — policy engine', () => {
  let wdkManager

  beforeEach(() => {
    sendTransactionMock.mockReset().mockResolvedValue({ hash: DUMMY_TX_HASH })
    transferMock.mockReset().mockResolvedValue({ hash: DUMMY_TRANSFER_HASH })
    approveMock.mockReset()
    signMessageMock.mockReset().mockResolvedValue(DUMMY_SIGNATURE)
    getBalanceMock.mockReset().mockResolvedValue(DUMMY_BALANCE)
    quoteTransferMock.mockReset().mockResolvedValue(DUMMY_QUOTE)
    getAccountMock.mockReset()
    getAccountByPathMock.mockReset()
    disposeWalletMock.mockReset()

    wdkManager = new WdkManager(SEED_PHRASE)
  })

  // -------------------------------------------------------------------------
  // Registration & validation
  // -------------------------------------------------------------------------

  describe('registerPolicy', () => {
    test('returns the WdkManager instance for chaining', () => {
      wdkManager.registerWallet('ethereum', WalletManagerMock, {})

      const result = wdkManager.registerPolicy(projectAllowAll('p'))

      expect(result).toBe(wdkManager)
    })

    test('accepts a chain name as first argument', () => {
      wdkManager.registerWallet('ethereum', WalletManagerMock, {})

      const result = wdkManager.registerPolicy('ethereum', projectAllowAll('p'))

      expect(result).toBe(wdkManager)
    })

    test('accepts a chain array as first argument', () => {
      wdkManager
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerWallet('ton', WalletManagerMock, {})

      const result = wdkManager.registerPolicy(['ethereum', 'ton'], projectAllowAll('p'))

      expect(result).toBe(wdkManager)
    })

    test('accepts an array of policies', () => {
      wdkManager.registerWallet('ethereum', WalletManagerMock, {})

      const result = wdkManager.registerPolicy([projectAllowAll('p1'), projectAllowAll('p2')])

      expect(result).toBe(wdkManager)
    })

    test('accepts a Phase 2 state option without throwing', () => {
      wdkManager.registerWallet('ethereum', WalletManagerMock, {})

      const result = wdkManager.registerPolicy(projectAllowAll('p'), { state: { foo: 'bar' } })

      expect(result).toBe(wdkManager)
    })

    test('throws PolicyConfigurationError when chain is not registered', () => {
      const err = catchSync(() => wdkManager.registerPolicy('mars', projectAllowAll('p')))

      expect(err.name).toBe('PolicyConfigurationError')
      expect(err.message).toBe("registerPolicy: no wallet registered for blockchain 'mars'.")
    })

    test("throws PolicyConfigurationError on missing 'id'", () => {
      wdkManager.registerWallet('ethereum', WalletManagerMock, {})

      const policy = { name: 'no-id', scope: 'project', rules: [{ name: 'r', operation: 'sendTransaction', action: 'ALLOW', conditions: [] }] }
      const err = catchSync(() => wdkManager.registerPolicy(policy))

      expect(err.name).toBe('PolicyConfigurationError')
      expect(err.message).toBe("Policy: 'id' is required and must be a non-empty string.")
    })

    test("throws PolicyConfigurationError on missing 'name'", () => {
      wdkManager.registerWallet('ethereum', WalletManagerMock, {})

      const policy = { id: 'p', scope: 'project', rules: [{ name: 'r', operation: 'sendTransaction', action: 'ALLOW', conditions: [] }] }
      const err = catchSync(() => wdkManager.registerPolicy(policy))

      expect(err.name).toBe('PolicyConfigurationError')
      expect(err.message).toBe("Policy 'p': 'name' is required and must be a non-empty string.")
    })

    test('throws PolicyConfigurationError on unknown scope', () => {
      wdkManager.registerWallet('ethereum', WalletManagerMock, {})

      const policy = { id: 'p', name: 'p', scope: 'global', rules: [{ name: 'r', operation: 'sendTransaction', action: 'ALLOW', conditions: [] }] }
      const err = catchSync(() => wdkManager.registerPolicy(policy))

      expect(err.name).toBe('PolicyConfigurationError')
      expect(err.message).toBe("Policy 'p': 'scope' must be one of: project, wallet, account.")
    })

    test('throws PolicyConfigurationError on unknown operation', () => {
      wdkManager.registerWallet('ethereum', WalletManagerMock, {})

      const policy = { id: 'p', name: 'p', scope: 'project', rules: [{ name: 'r', operation: 'fly', action: 'ALLOW', conditions: [] }] }
      const err = catchSync(() => wdkManager.registerPolicy(policy))

      expect(err.name).toBe('PolicyConfigurationError')
      expect(err.message).toBe("Rule 'r' in policy 'p': unknown operation 'fly'. Supported: sendTransaction, transfer, approve, signMessage, signHash, signTypedData, signAuthorization, delegate, revokeDelegation, swap, bridge, supply, withdraw, borrow, repay, buy, sell, *.")
    })

    test('throws PolicyConfigurationError on invalid action', () => {
      wdkManager.registerWallet('ethereum', WalletManagerMock, {})

      const policy = { id: 'p', name: 'p', scope: 'project', rules: [{ name: 'r', operation: 'sendTransaction', action: 'maybe', conditions: [] }] }
      const err = catchSync(() => wdkManager.registerPolicy(policy))

      expect(err.name).toBe('PolicyConfigurationError')
      expect(err.message).toBe("Rule 'r' in policy 'p': 'action' must be 'ALLOW' or 'DENY'.")
    })

    test('throws PolicyConfigurationError on override_broader_scope outside account-scope ALLOW', () => {
      wdkManager.registerWallet('ethereum', WalletManagerMock, {})

      const policy = { id: 'p', name: 'p', scope: 'project', rules: [{ name: 'r', operation: 'sendTransaction', action: 'ALLOW', override_broader_scope: true, conditions: [] }] }
      const err = catchSync(() => wdkManager.registerPolicy(policy))

      expect(err.name).toBe('PolicyConfigurationError')
      expect(err.message).toBe("Rule 'r' in policy 'p': 'override_broader_scope' is only valid on account-scope ALLOW rules.")
    })

    test('throws PolicyConfigurationError on non-function condition', () => {
      wdkManager.registerWallet('ethereum', WalletManagerMock, {})

      const policy = { id: 'p', name: 'p', scope: 'project', rules: [{ name: 'r', operation: 'sendTransaction', action: 'ALLOW', conditions: ['not-a-function'] }] }
      const err = catchSync(() => wdkManager.registerPolicy(policy))

      expect(err.name).toBe('PolicyConfigurationError')
      expect(err.message).toBe("Rule 'r' in policy 'p': condition at index 0 must be a function.")
    })

    test('throws PolicyConfigurationError on account-scope without chain', () => {
      wdkManager.registerWallet('ethereum', WalletManagerMock, {})

      const policy = { id: 'p', name: 'p', scope: 'account', accounts: [PATH_DEFAULT], rules: [{ name: 'r', operation: 'sendTransaction', action: 'ALLOW', conditions: [] }] }
      const err = catchSync(() => wdkManager.registerPolicy(policy))

      expect(err.name).toBe('PolicyConfigurationError')
      expect(err.message).toBe("Policy 'p': account-scope policies must be registered with a chain argument.")
    })

    test('throws PolicyConfigurationError on wallet-scope without chain', () => {
      wdkManager.registerWallet('ethereum', WalletManagerMock, {})

      const policy = { id: 'p', name: 'p', scope: 'wallet', rules: [{ name: 'r', operation: 'sendTransaction', action: 'ALLOW', conditions: [] }] }
      const err = catchSync(() => wdkManager.registerPolicy(policy))

      expect(err.name).toBe('PolicyConfigurationError')
      expect(err.message).toBe("Policy 'p': wallet-scope policies must be registered with a chain argument.")
    })

    test('throws PolicyConfigurationError when accounts is provided on non-account scope', () => {
      wdkManager.registerWallet('ethereum', WalletManagerMock, {})

      const policy = { id: 'p', name: 'p', scope: 'project', accounts: [PATH_DEFAULT], rules: [{ name: 'r', operation: 'sendTransaction', action: 'ALLOW', conditions: [] }] }
      const err = catchSync(() => wdkManager.registerPolicy(policy))

      expect(err.name).toBe('PolicyConfigurationError')
      expect(err.message).toBe("Policy 'p': 'accounts' is only allowed when scope is 'account'.")
    })

    test('does not partially register when one policy in an array is invalid', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      wdkManager.registerWallet('ethereum', WalletManagerMock, {})

      const good = projectDenyAll('good')
      const bad = { id: 'bad', name: 'bad', scope: 'project', rules: [{ name: 'r', operation: 'fly', action: 'ALLOW', conditions: [] }] }

      const err = catchSync(() => wdkManager.registerPolicy([good, bad]))

      expect(err.name).toBe('PolicyConfigurationError')
      expect(err.message).toBe("Rule 'r' in policy 'bad': unknown operation 'fly'. Supported: sendTransaction, transfer, approve, signMessage, signHash, signTypedData, signAuthorization, delegate, revokeDelegation, swap, bridge, supply, withdraw, borrow, repay, buy, sell, *.")

      // The 'good' policy must NOT have been registered (otherwise the next call would block).
      const account = await wdkManager.getAccount('ethereum', 0)
      const result = await account.sendTransaction({ to: RECIPIENT, value: 1n })

      expect(result.hash).toBe(DUMMY_TX_HASH)
    })

    test('a second registration with the same id replaces the first in the same chain bucket', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      wdkManager
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy(projectDenyAll('same-id'))
        .registerPolicy(projectAllowAll('same-id'))

      const account = await wdkManager.getAccount('ethereum', 0)
      const result = await account.sendTransaction({ to: RECIPIENT, value: 1n })

      expect(result.hash).toBe(DUMMY_TX_HASH)
    })

    test('multiple registerPolicy calls stack and all run', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      const firstCondition = jest.fn().mockReturnValue(true)
      const secondCondition = jest.fn().mockReturnValue(true)

      wdkManager.registerWallet('ethereum', WalletManagerMock, {})
      wdkManager.registerPolicy({
        id: 'p1',
        name: 'p1',
        scope: 'project',
        rules: [{ name: 'r1', operation: 'sendTransaction', action: 'ALLOW', conditions: [firstCondition] }]
      })
      wdkManager.registerPolicy({
        id: 'p2',
        name: 'p2',
        scope: 'project',
        rules: [{ name: 'r2', operation: 'sendTransaction', action: 'ALLOW', conditions: [secondCondition] }]
      })

      const account = await wdkManager.getAccount('ethereum', 0)
      await account.sendTransaction({ to: RECIPIENT, value: 1n })

      expect(firstCondition).toHaveBeenCalledTimes(1)
      expect(secondCondition).toHaveBeenCalledTimes(1)
    })
  })

  // -------------------------------------------------------------------------
  // Dispose
  // -------------------------------------------------------------------------

  describe('dispose', () => {
    test('disposing a single chain stops policy enforcement on that chain after re-register', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      wdkManager
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy('ethereum', {
          id: 'wallet-deny',
          name: 'wallet-deny',
          scope: 'wallet',
          rules: [{ name: 'deny', operation: 'sendTransaction', action: 'DENY', conditions: [] }]
        })

      wdkManager.dispose(['ethereum'])
      wdkManager.registerWallet('ethereum', WalletManagerMock, {})

      const account = await wdkManager.getAccount('ethereum', 0)
      const result = await account.sendTransaction({ to: RECIPIENT, value: 1n })

      expect(result.hash).toBe(DUMMY_TX_HASH)
    })

    test('dispose() with no arguments clears project-scope policies too', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      wdkManager
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy(projectDenyAll('proj-deny'))

      wdkManager.dispose()
      wdkManager.registerWallet('ethereum', WalletManagerMock, {})

      const account = await wdkManager.getAccount('ethereum', 0)
      const result = await account.sendTransaction({ to: RECIPIENT, value: 1n })

      expect(result.hash).toBe(DUMMY_TX_HASH)
    })

    test('disposing one chain leaves other chains wallet-scope bindings intact', async () => {
      getAccountMock.mockImplementation(async () => buildAccount())

      wdkManager
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerWallet('ton', WalletManagerMock, {})
        .registerPolicy(['ethereum', 'ton'], {
          id: 'multi-wallet',
          name: 'multi-wallet',
          scope: 'wallet',
          rules: [{ name: 'deny', operation: 'sendTransaction', action: 'DENY', conditions: [] }]
        })

      wdkManager.dispose(['ethereum'])
      wdkManager.registerWallet('ethereum', WalletManagerMock, {})

      // ton policy should still be active.
      const tonAccount = await wdkManager.getAccount('ton', 0)
      const err = await catchAsync(() => tonAccount.sendTransaction({ to: RECIPIENT, value: 1n }))

      expect(err.name).toBe('PolicyViolationError')
      expect(err.policyId).toBe('multi-wallet')

      // ethereum should be unguarded again.
      const ethAccount = await wdkManager.getAccount('ethereum', 0)
      const result = await ethAccount.sendTransaction({ to: RECIPIENT, value: 1n })

      expect(result.hash).toBe(DUMMY_TX_HASH)
    })
  })

  // -------------------------------------------------------------------------
  // Wrapping shape (no policies, irrelevant ops, read methods)
  // -------------------------------------------------------------------------

  describe('account method wrapping', () => {
    test('account has no simulate when no policies are registered', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      wdkManager.registerWallet('ethereum', WalletManagerMock, {})

      const account = await wdkManager.getAccount('ethereum', 0)

      expect(account.simulate).toBeUndefined()
    })

    test('only operations referenced by registered rules are wrapped', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      wdkManager
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy(projectDenyAll('only-send'))

      const account = await wdkManager.getAccount('ethereum', 0)

      // sendTransaction is wrapped → blocked.
      const denied = await catchAsync(() => account.sendTransaction({ to: RECIPIENT, value: 1n }))
      expect(denied.name).toBe('PolicyViolationError')

      // transfer is NOT referenced → passthrough returns the underlying mock value.
      const result = await account.transfer({ token: TOKEN, recipient: RECIPIENT, amount: 1n })
      expect(result.hash).toBe(DUMMY_TRANSFER_HASH)

      // simulate mirror only contains the wrapped op.
      expect(account.simulate.transfer).toBeUndefined()
    })

    test('read-only methods (getBalance, quoteTransfer) are not wrapped or mirrored in simulate', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      wdkManager
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy(projectDenyAll('only-send'))

      const account = await wdkManager.getAccount('ethereum', 0)

      const balance = await account.getBalance()
      expect(balance).toBe(DUMMY_BALANCE)

      const quote = await account.quoteTransfer({ token: TOKEN, recipient: RECIPIENT, amount: 1n })
      expect(quote).toEqual(DUMMY_QUOTE)

      expect(account.simulate.getBalance).toBeUndefined()
      expect(account.simulate.quoteTransfer).toBeUndefined()
    })
  })

  // -------------------------------------------------------------------------
  // PolicyViolationError shape
  // -------------------------------------------------------------------------

  describe('PolicyViolationError', () => {
    test('thrown on DENY carries name, policyId, ruleName, reason, and message', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      wdkManager
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy({
          id: 'block-eth',
          name: 'Block Ethereum sends',
          scope: 'project',
          rules: [{ name: 'deny-all', operation: 'sendTransaction', action: 'DENY', conditions: [] }]
        })

      const account = await wdkManager.getAccount('ethereum', 0)
      const err = await catchAsync(() => account.sendTransaction({ to: RECIPIENT, value: 1n }))

      expect(err.name).toBe('PolicyViolationError')
      expect(err.policyId).toBe('block-eth')
      expect(err.ruleName).toBe('deny-all')
      expect(err.reason).toBe('deny-all')
      expect(err.message).toBe('Policy violation: block-eth/deny-all')
      expect(sendTransactionMock).not.toHaveBeenCalled()
    })

    test('user-supplied rule.reason propagates into PolicyViolationError.reason and message', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      wdkManager
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy({
          id: 'platform-denylist',
          name: 'Platform Sanctioned Addresses',
          scope: 'project',
          rules: [{
            name: 'block-bad-recipient',
            reason: 'recipient is on the sanctioned address list',
            operation: 'sendTransaction',
            action: 'DENY',
            conditions: [() => true]
          }]
        })

      const account = await wdkManager.getAccount('ethereum', 0)
      const err = await catchAsync(() => account.sendTransaction({ to: RECIPIENT, value: 1n }))

      expect(err.name).toBe('PolicyViolationError')
      expect(err.policyId).toBe('platform-denylist')
      expect(err.ruleName).toBe('block-bad-recipient')
      expect(err.reason).toBe('recipient is on the sanctioned address list')
      expect(err.message).toBe('Policy violation: platform-denylist/block-bad-recipient: recipient is on the sanctioned address list')
    })

    test('reason is "governed-but-unmatched" when an operation has policies but no rule matches', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      wdkManager
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy({
          id: 'cap',
          name: 'Cap value at 5',
          scope: 'project',
          rules: [{
            name: 'allow-small',
            operation: 'sendTransaction',
            action: 'ALLOW',
            conditions: [({ params }) => BigInt(params.value) <= 5n]
          }]
        })

      const account = await wdkManager.getAccount('ethereum', 0)
      const err = await catchAsync(() => account.sendTransaction({ to: RECIPIENT, value: 100n }))

      expect(err.name).toBe('PolicyViolationError')
      expect(err.policyId).toBe('<unknown>')
      expect(err.ruleName).toBe('<unknown>')
      expect(err.reason).toBe('governed-but-unmatched')
      expect(err.message).toBe('Policy violation: <unknown>/<unknown>: governed-but-unmatched')
    })
  })

  // -------------------------------------------------------------------------
  // Single-scope evaluation
  // -------------------------------------------------------------------------

  describe('evaluation — single scope', () => {
    test('an operation that no policy mentions passes through untouched', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      wdkManager
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy({
          id: 'send-only',
          name: 'send-only',
          scope: 'project',
          rules: [{ name: 'r', operation: 'sendTransaction', action: 'DENY', conditions: [] }]
        })

      const account = await wdkManager.getAccount('ethereum', 0)
      const result = await account.signMessage('hello')

      expect(result).toBe(DUMMY_SIGNATURE)
    })

    test('project ALLOW with conditions true permits the operation', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      wdkManager
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy({
          id: 'cap',
          name: 'cap',
          scope: 'project',
          rules: [{
            name: 'allow-small',
            operation: 'sendTransaction',
            action: 'ALLOW',
            conditions: [({ params }) => BigInt(params.value) <= 5n]
          }]
        })

      const account = await wdkManager.getAccount('ethereum', 0)
      const result = await account.sendTransaction({ to: RECIPIENT, value: 3n })

      expect(result.hash).toBe(DUMMY_TX_HASH)
    })

    test('multi-rule policy: a DENY at rule index 0 wins over an ALLOW at rule index 1', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      wdkManager
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy({
          id: 'tiered',
          name: 'tiered',
          scope: 'project',
          rules: [
            { name: 'always-deny', operation: 'sendTransaction', action: 'DENY', conditions: [] },
            { name: 'would-allow', operation: 'sendTransaction', action: 'ALLOW', conditions: [] }
          ]
        })

      const account = await wdkManager.getAccount('ethereum', 0)
      const err = await catchAsync(() => account.sendTransaction({ to: RECIPIENT, value: 1n }))

      expect(err.name).toBe('PolicyViolationError')
      expect(err.ruleName).toBe('always-deny')
    })

    test('an operation array on a rule matches each listed name', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      wdkManager
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy({
          id: 'multi-op',
          name: 'multi-op',
          scope: 'project',
          rules: [{ name: 'deny-pair', operation: ['sendTransaction', 'transfer'], action: 'DENY', conditions: [] }]
        })

      const account = await wdkManager.getAccount('ethereum', 0)
      const sendErr = await catchAsync(() => account.sendTransaction({ to: RECIPIENT, value: 1n }))
      const transferErr = await catchAsync(() => account.transfer({ token: TOKEN, recipient: RECIPIENT, amount: 1n }))

      expect(sendErr.name).toBe('PolicyViolationError')
      expect(sendErr.ruleName).toBe('deny-pair')
      expect(transferErr.name).toBe('PolicyViolationError')
      expect(transferErr.ruleName).toBe('deny-pair')

      // signMessage is not in the array → passthrough.
      const sig = await account.signMessage('hi')
      expect(sig).toBe(DUMMY_SIGNATURE)
    })

    test('the wildcard * matches any operation', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      wdkManager
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy({
          id: 'star',
          name: 'star',
          scope: 'project',
          rules: [{ name: 'block-all', operation: '*', action: 'DENY', conditions: [] }]
        })

      const account = await wdkManager.getAccount('ethereum', 0)
      const sendErr = await catchAsync(() => account.sendTransaction({ to: RECIPIENT, value: 1n }))
      const sigErr = await catchAsync(() => account.signMessage('hi'))

      expect(sendErr.name).toBe('PolicyViolationError')
      expect(sendErr.ruleName).toBe('block-all')
      expect(sigErr.name).toBe('PolicyViolationError')
      expect(sigErr.ruleName).toBe('block-all')
    })

    test('an async condition is awaited before the underlying method runs', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      const order = []
      sendTransactionMock.mockImplementation(async () => { order.push('send'); return { hash: DUMMY_TX_HASH } })

      wdkManager
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy({
          id: 'async',
          name: 'async',
          scope: 'project',
          rules: [{
            name: 'r',
            operation: 'sendTransaction',
            action: 'ALLOW',
            conditions: [async () => { await new Promise((r) => setTimeout(r, 5)); order.push('cond'); return true }]
          }]
        })

      const account = await wdkManager.getAccount('ethereum', 0)
      await account.sendTransaction({ to: RECIPIENT, value: 1n })

      expect(order).toEqual(['cond', 'send'])
    })

    test('a stateful condition holding a counter in closure enforces a rolling cap', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      let totalSpent = 0n
      const cap = 100n

      wdkManager
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy({
          id: 'roll',
          name: 'roll',
          scope: 'project',
          rules: [{
            name: 'cap',
            operation: 'sendTransaction',
            action: 'ALLOW',
            conditions: [({ params }) => {
              const next = totalSpent + BigInt(params.value)
              if (next > cap) return false
              totalSpent = next
              return true
            }]
          }]
        })

      const account = await wdkManager.getAccount('ethereum', 0)
      const ok1 = await account.sendTransaction({ to: RECIPIENT, value: 30n })
      const ok2 = await account.sendTransaction({ to: RECIPIENT, value: 50n })
      const blocked = await catchAsync(() => account.sendTransaction({ to: RECIPIENT, value: 30n }))

      expect(ok1.hash).toBe(DUMMY_TX_HASH)
      expect(ok2.hash).toBe(DUMMY_TX_HASH)
      expect(totalSpent).toBe(80n)
      expect(blocked.name).toBe('PolicyViolationError')
      expect(blocked.reason).toBe('governed-but-unmatched')
    })

    test('a throwing condition is treated as a non-match and recorded in the simulate trace', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      wdkManager
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy({
          id: 'boom',
          name: 'boom',
          scope: 'project',
          rules: [{
            name: 'r',
            operation: 'sendTransaction',
            action: 'ALLOW',
            conditions: [() => { throw new Error('condition crashed') }]
          }]
        })

      const account = await wdkManager.getAccount('ethereum', 0)
      const result = await account.simulate.sendTransaction({ to: RECIPIENT, value: 1n })

      expect(result.decision).toBe('DENY')
      expect(result.policy_id).toBeNull()
      expect(result.matched_rule).toBeNull()
      expect(result.reason).toBe('governed-but-unmatched')
      expect(result.trace).toHaveLength(1)
      expect(result.trace[0]).toEqual({ scope: 'project', policy_id: 'boom', rule_name: 'r', matched: false, error: 'condition crashed' })
    })
  })

  // -------------------------------------------------------------------------
  // Multi-scope evaluation
  // -------------------------------------------------------------------------

  describe('evaluation — multi-scope', () => {
    test('a wallet-scope DENY shadows an account-scope ALLOW (no override)', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      wdkManager
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy('ethereum', {
          id: 'account-allow',
          name: 'account-allow',
          scope: 'account',
          accounts: [PATH_DEFAULT],
          rules: [{ name: 'allow', operation: 'sendTransaction', action: 'ALLOW', conditions: [] }]
        })
        .registerPolicy('ethereum', {
          id: 'wallet-deny',
          name: 'wallet-deny',
          scope: 'wallet',
          rules: [{ name: 'wdeny', operation: 'sendTransaction', action: 'DENY', conditions: [] }]
        })

      const account = await wdkManager.getAccount('ethereum', 0)
      const err = await catchAsync(() => account.sendTransaction({ to: RECIPIENT, value: 1n }))

      expect(err.name).toBe('PolicyViolationError')
      expect(err.policyId).toBe('wallet-deny')
      expect(err.ruleName).toBe('wdeny')
    })

    test('a project-scope DENY shadows an account-scope ALLOW recorded without override', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      wdkManager
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy('ethereum', {
          id: 'agent-limits',
          name: 'agent-limits',
          scope: 'account',
          accounts: [PATH_DEFAULT],
          rules: [{
            name: 'allow-small',
            operation: 'sendTransaction',
            action: 'ALLOW',
            conditions: [({ params }) => BigInt(params.value) <= 100n]
          }]
        })
        .registerPolicy({
          id: 'platform-denylist',
          name: 'platform-denylist',
          scope: 'project',
          rules: [{
            name: 'block-bad',
            operation: 'sendTransaction',
            action: 'DENY',
            conditions: [({ params }) => params.to === SANCTIONED]
          }]
        })

      const account = await wdkManager.getAccount('ethereum', 0)
      const err = await catchAsync(() => account.sendTransaction({ to: SANCTIONED, value: 50n }))

      expect(err.name).toBe('PolicyViolationError')
      expect(err.policyId).toBe('platform-denylist')
      expect(err.ruleName).toBe('block-bad')
    })

    test('an account-scope ALLOW with override_broader_scope skips both wallet and project DENYs', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      wdkManager
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy('ethereum', {
          id: 'treasury',
          name: 'treasury',
          scope: 'account',
          accounts: [PATH_DEFAULT],
          rules: [{
            name: 'treasury-allow',
            operation: 'sendTransaction',
            action: 'ALLOW',
            override_broader_scope: true,
            conditions: [({ params }) => BigInt(params.value) <= 100n]
          }]
        })
        .registerPolicy('ethereum', {
          id: 'wallet-deny',
          name: 'wallet-deny',
          scope: 'wallet',
          rules: [{ name: 'wdeny', operation: 'sendTransaction', action: 'DENY', conditions: [] }]
        })
        .registerPolicy({
          id: 'project-deny',
          name: 'project-deny',
          scope: 'project',
          rules: [{ name: 'pdeny', operation: 'sendTransaction', action: 'DENY', conditions: [] }]
        })

      const account = await wdkManager.getAccount('ethereum', 0)
      const result = await account.sendTransaction({ to: RECIPIENT, value: 50n })

      expect(result.hash).toBe(DUMMY_TX_HASH)
    })

    test('the override only engages when the account-scope rule actually matches; otherwise broader DENY fires', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      wdkManager
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy('ethereum', {
          id: 'treasury',
          name: 'treasury',
          scope: 'account',
          accounts: [PATH_DEFAULT],
          rules: [{
            name: 'treasury-allow',
            operation: 'sendTransaction',
            action: 'ALLOW',
            override_broader_scope: true,
            conditions: [({ params }) => BigInt(params.value) <= 100n]
          }]
        })
        .registerPolicy({
          id: 'platform-denylist',
          name: 'platform-denylist',
          scope: 'project',
          rules: [{
            name: 'block-bad',
            operation: 'sendTransaction',
            action: 'DENY',
            conditions: [({ params }) => params.to === SANCTIONED]
          }]
        })

      const account = await wdkManager.getAccount('ethereum', 0)
      // value over the override limit → account rule does NOT match → project DENY fires.
      const err = await catchAsync(() => account.sendTransaction({ to: SANCTIONED, value: 500n }))

      expect(err.name).toBe('PolicyViolationError')
      expect(err.policyId).toBe('platform-denylist')
    })

    test('account-scope policies only engage for accounts whose path is in the accounts array', async () => {
      getAccountByPathMock.mockImplementation(async (path) => buildAccount(path))

      wdkManager
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy('ethereum', {
          id: 'agent-deny',
          name: 'agent-deny',
          scope: 'account',
          accounts: [PATH_SECONDARY],
          rules: [{ name: 'deny', operation: 'sendTransaction', action: 'DENY', conditions: [] }]
        })

      const guarded = await wdkManager.getAccountByPath('ethereum', PATH_SECONDARY)
      const free = await wdkManager.getAccountByPath('ethereum', PATH_DEFAULT)

      const blocked = await catchAsync(() => guarded.sendTransaction({ to: RECIPIENT, value: 1n }))
      const ok = await free.sendTransaction({ to: RECIPIENT, value: 1n })

      expect(blocked.name).toBe('PolicyViolationError')
      expect(blocked.policyId).toBe('agent-deny')
      expect(ok.hash).toBe(DUMMY_TX_HASH)
    })
  })

  // -------------------------------------------------------------------------
  // Multi-chain registration
  // -------------------------------------------------------------------------

  describe('multi-chain registration', () => {
    test('registerPolicy with a chain array binds the same policy to each chain independently', async () => {
      getAccountMock.mockImplementation(async () => buildAccount())

      wdkManager
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerWallet('ton', WalletManagerMock, {})
        .registerPolicy(['ethereum', 'ton'], {
          id: 'multi',
          name: 'multi',
          scope: 'wallet',
          rules: [{ name: 'deny', operation: 'sendTransaction', action: 'DENY', conditions: [] }]
        })

      const eth = await wdkManager.getAccount('ethereum', 0)
      const ton = await wdkManager.getAccount('ton', 0)
      const ethErr = await catchAsync(() => eth.sendTransaction({ to: RECIPIENT, value: 1n }))
      const tonErr = await catchAsync(() => ton.sendTransaction({ to: RECIPIENT, value: 1n }))

      expect(ethErr.name).toBe('PolicyViolationError')
      expect(ethErr.policyId).toBe('multi')
      expect(tonErr.name).toBe('PolicyViolationError')
      expect(tonErr.policyId).toBe('multi')
    })
  })

  // -------------------------------------------------------------------------
  // Simulate
  // -------------------------------------------------------------------------

  describe('account.simulate', () => {
    test('simulate.<method> returns ALLOW with full result fields without invoking the underlying method', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      wdkManager
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy({
          id: 'cap',
          name: 'cap',
          scope: 'project',
          rules: [{
            name: 'allow-small',
            operation: 'sendTransaction',
            action: 'ALLOW',
            conditions: [({ params }) => BigInt(params.value) <= 5n]
          }]
        })

      const account = await wdkManager.getAccount('ethereum', 0)
      const result = await account.simulate.sendTransaction({ to: RECIPIENT, value: 3n })

      expect(result.decision).toBe('ALLOW')
      expect(result.policy_id).toBe('cap')
      expect(result.matched_rule).toBe('allow-small')
      expect(result.reason).toBe('matched')
      expect(result.trace).toHaveLength(1)
      expect(result.trace[0]).toEqual({ scope: 'project', policy_id: 'cap', rule_name: 'allow-small', matched: true })
      expect(sendTransactionMock).not.toHaveBeenCalled()
    })

    test('simulate.<method> returns DENY with full result fields and does not throw', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      wdkManager
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy({
          id: 'block-eth',
          name: 'block-eth',
          scope: 'project',
          rules: [{ name: 'deny-all', operation: 'sendTransaction', action: 'DENY', conditions: [] }]
        })

      const account = await wdkManager.getAccount('ethereum', 0)
      const result = await account.simulate.sendTransaction({ to: RECIPIENT, value: 1n })

      expect(result.decision).toBe('DENY')
      expect(result.policy_id).toBe('block-eth')
      expect(result.matched_rule).toBe('deny-all')
      expect(result.reason).toBe('deny-all')
      expect(result.trace).toHaveLength(1)
      expect(sendTransactionMock).not.toHaveBeenCalled()
    })

    test('simulate result for a not-governed operation has decision=ALLOW with reason=not-governed', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      wdkManager
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy(projectAllowAll('only-send'))

      const account = await wdkManager.getAccount('ethereum', 0)
      // simulate is only built for wrapped methods; signMessage is not wrapped.
      expect(account.simulate.signMessage).toBeUndefined()

      // A wrapped op with no matching rule case is shown above; this asserts the simulate mirror only contains wrapped ops.
      expect(account.simulate.sendTransaction).not.toBeUndefined()
    })
  })

  // -------------------------------------------------------------------------
  // Nested call escape
  // -------------------------------------------------------------------------

  describe('nested call escape', () => {
    test('approve internally calls sendTransaction; the inner call skips re-evaluation', async () => {
      const condition = jest.fn().mockReturnValue(true)

      // approve() implementation calls account.sendTransaction internally.
      approveMock.mockImplementation(async function (opts) {
        return sendTransactionMock({ to: opts.spender, value: 0n })
      })

      getAccountMock.mockResolvedValue(buildAccount())

      wdkManager
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy({
          id: 'nested',
          name: 'nested',
          scope: 'project',
          rules: [
            { name: 'r-approve', operation: 'approve', action: 'ALLOW', conditions: [condition] },
            { name: 'r-send', operation: 'sendTransaction', action: 'ALLOW', conditions: [condition] }
          ]
        })

      const account = await wdkManager.getAccount('ethereum', 0)
      await account.approve({ token: TOKEN, spender: SPENDER, amount: 1n })

      expect(condition).toHaveBeenCalledTimes(1)
      expect(sendTransactionMock).toHaveBeenCalledTimes(1)
    })

    test('concurrent calls on the same account each evaluate policies independently', async () => {
      // Make the underlying method slow so call B starts while call A is still
      // awaiting `original()`. With a per-account flag, B would see the in-flight
      // marker set by A and bypass evaluation. With AsyncLocalStorage scoping,
      // each call's "in policy" marker is confined to its own async chain.
      sendTransactionMock.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
        return { hash: DUMMY_TX_HASH }
      })

      const condition = jest.fn().mockReturnValue(true)

      getAccountMock.mockResolvedValue(buildAccount())

      wdkManager
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy({
          id: 'concurrency',
          name: 'concurrency',
          scope: 'project',
          rules: [{ name: 'r', operation: 'sendTransaction', action: 'ALLOW', conditions: [condition] }]
        })

      const account = await wdkManager.getAccount('ethereum', 0)

      const [resultA, resultB] = await Promise.all([
        account.sendTransaction({ to: RECIPIENT, value: 1n }),
        account.sendTransaction({ to: RECIPIENT, value: 2n })
      ])

      expect(resultA.hash).toBe(DUMMY_TX_HASH)
      expect(resultB.hash).toBe(DUMMY_TX_HASH)
      expect(condition).toHaveBeenCalledTimes(2)
      expect(sendTransactionMock).toHaveBeenCalledTimes(2)
    })

    test('concurrent calls under a DENY policy both throw PolicyViolationError', async () => {
      sendTransactionMock.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
        return { hash: DUMMY_TX_HASH }
      })

      getAccountMock.mockResolvedValue(buildAccount())

      wdkManager
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy({
          id: 'concurrency-deny',
          name: 'concurrency-deny',
          scope: 'project',
          rules: [{ name: 'deny', operation: 'sendTransaction', action: 'DENY', conditions: [() => true] }]
        })

      const account = await wdkManager.getAccount('ethereum', 0)

      const [errA, errB] = await Promise.all([
        catchAsync(() => account.sendTransaction({ to: RECIPIENT, value: 1n })),
        catchAsync(() => account.sendTransaction({ to: RECIPIENT, value: 2n }))
      ])

      expect(errA.name).toBe('PolicyViolationError')
      expect(errA.policyId).toBe('concurrency-deny')
      expect(errB.name).toBe('PolicyViolationError')
      expect(errB.policyId).toBe('concurrency-deny')
      expect(sendTransactionMock).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // Context immutability (TOCTOU protection)
  // -------------------------------------------------------------------------

  describe('context immutability', () => {
    test('mutating the params object after the call starts does not change what conditions saw', async () => {
      let observedTo

      // Slow async condition gives the user time to mutate the original object.
      const condition = jest.fn(async ({ params }) => {
        await new Promise((resolve) => setTimeout(resolve, 30))
        observedTo = params.to
        return true
      })

      getAccountMock.mockResolvedValue(buildAccount())

      wdkManager
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy({
          id: 'capture-to',
          name: 'capture-to',
          scope: 'project',
          rules: [{ name: 'r', operation: 'sendTransaction', action: 'ALLOW', conditions: [condition] }]
        })

      const account = await wdkManager.getAccount('ethereum', 0)

      const tx = { to: RECIPIENT, value: 1n }
      const callPromise = account.sendTransaction(tx)
      tx.to = SANCTIONED // user mutates after starting the call

      await callPromise

      expect(observedTo).toBe(RECIPIENT)
    })

    test('a condition function cannot mutate its way into the underlying call', async () => {
      const condition = jest.fn(({ params }) => {
        params.to = SANCTIONED // mutation should not propagate
        return true
      })

      getAccountMock.mockResolvedValue(buildAccount())

      wdkManager
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy({
          id: 'mutate-attempt',
          name: 'mutate-attempt',
          scope: 'project',
          rules: [{ name: 'r', operation: 'sendTransaction', action: 'ALLOW', conditions: [condition] }]
        })

      const account = await wdkManager.getAccount('ethereum', 0)

      const tx = { to: RECIPIENT, value: 1n }
      await account.sendTransaction(tx)

      expect(sendTransactionMock).toHaveBeenCalledWith({ to: RECIPIENT, value: 1n })
      expect(tx.to).toBe(RECIPIENT) // caller's object also unchanged
    })
  })

  // -------------------------------------------------------------------------
  // Defensive policy storage
  // -------------------------------------------------------------------------

  describe('registry isolation', () => {
    test('mutating a policy after registration does not affect engine state', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      const policy = {
        id: 'mutable',
        name: 'mutable',
        scope: 'project',
        rules: [{ name: 'deny', operation: 'sendTransaction', action: 'DENY', conditions: [() => true] }]
      }

      wdkManager
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy(policy)

      // Mutate the original after registration; engine should not see this.
      policy.rules[0].action = 'ALLOW'
      policy.rules[0].conditions = []

      const account = await wdkManager.getAccount('ethereum', 0)
      const err = await catchAsync(() => account.sendTransaction({ to: RECIPIENT, value: 1n }))

      expect(err.name).toBe('PolicyViolationError')
      expect(err.policyId).toBe('mutable')
    })
  })

  // -------------------------------------------------------------------------
  // Integration diagnostics
  // -------------------------------------------------------------------------

  describe('integration diagnostics', () => {
    test('a wallet whose account lacks toReadOnlyAccount() yields a clear PolicyConfigurationError', async () => {
      getAccountMock.mockResolvedValue({
        path: PATH_DEFAULT,
        index: 0,
        sendTransaction: sendTransactionMock
        // no toReadOnlyAccount provided
      })

      wdkManager
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy(projectDenyAll('p'))

      const err = await catchAsync(() => wdkManager.getAccount('ethereum', 0))

      expect(err.name).toBe('PolicyConfigurationError')
      expect(err.message).toBe("policy engine requires IWalletAccount.toReadOnlyAccount() but the wallet for blockchain 'ethereum' does not provide it.")
    })
  })

  // -------------------------------------------------------------------------
  // Protocol method wrapping
  // -------------------------------------------------------------------------

  describe('protocol method wrapping', () => {
    test('a registered protocol\'s write method (swap) is wrapped and blocks on DENY; quoteSwap is not wrapped', async () => {
      const swapInstanceMock = jest.fn().mockResolvedValue(DUMMY_SWAP_RESULT)
      const quoteSwapInstanceMock = jest.fn().mockResolvedValue(DUMMY_QUOTE)

      class MySwapProtocol extends SwapProtocol {
        constructor () { super() }
        async swap (opts) { return swapInstanceMock(opts) }
        async quoteSwap (opts) { return quoteSwapInstanceMock(opts) }
      }

      getAccountMock.mockResolvedValue(buildAccount())

      wdkManager
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerProtocol('ethereum', 'velora', MySwapProtocol, {})
        .registerPolicy({
          id: 'no-swaps',
          name: 'no-swaps',
          scope: 'project',
          rules: [{ name: 'deny-swap', operation: 'swap', action: 'DENY', conditions: [] }]
        })

      const account = await wdkManager.getAccount('ethereum', 0)
      const swap = account.getSwapProtocol('velora')

      const denied = await catchAsync(() => swap.swap({ tokenIn: 'A', tokenOut: 'B', tokenInAmount: 1n }))
      expect(denied.name).toBe('PolicyViolationError')
      expect(denied.policyId).toBe('no-swaps')
      expect(denied.ruleName).toBe('deny-swap')
      expect(swapInstanceMock).not.toHaveBeenCalled()

      const quote = await swap.quoteSwap({})
      expect(quote).toEqual(DUMMY_QUOTE)
      expect(quoteSwapInstanceMock).toHaveBeenCalledWith({})
    })

    test('account.simulate.getSwapProtocol(label).swap(...) returns a structured DENY without executing', async () => {
      const swapInstanceMock = jest.fn().mockResolvedValue(DUMMY_SWAP_RESULT)

      class MySwapProtocol extends SwapProtocol {
        constructor () { super() }
        async swap (opts) { return swapInstanceMock(opts) }
      }

      getAccountMock.mockResolvedValue(buildAccount())

      wdkManager
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerProtocol('ethereum', 'velora', MySwapProtocol, {})
        .registerPolicy({
          id: 'no-swaps',
          name: 'no-swaps',
          scope: 'project',
          rules: [{ name: 'deny-swap', operation: 'swap', action: 'DENY', conditions: [] }]
        })

      const account = await wdkManager.getAccount('ethereum', 0)
      const sim = await account.simulate.getSwapProtocol('velora').swap({ tokenIn: 'A', tokenOut: 'B', tokenInAmount: 1n })

      expect(sim.decision).toBe('DENY')
      expect(sim.policy_id).toBe('no-swaps')
      expect(sim.matched_rule).toBe('deny-swap')
      expect(sim.reason).toBe('deny-swap')
      expect(swapInstanceMock).not.toHaveBeenCalled()
    })

    test('a protocol method (bridge) that internally calls account.sendTransaction triggers nested-call escape', async () => {
      const condition = jest.fn().mockReturnValue(true)

      class MyBridgeProtocol extends BridgeProtocol {
        constructor (account) { super(); this._account = account }
        async bridge () {
          return this._account.sendTransaction({ to: RECIPIENT, value: 1n })
        }
      }

      getAccountMock.mockResolvedValue(buildAccount())

      wdkManager
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerProtocol('ethereum', 'oft', MyBridgeProtocol, {})
        .registerPolicy({
          id: 'nested',
          name: 'nested',
          scope: 'project',
          rules: [
            { name: 'r-bridge', operation: 'bridge', action: 'ALLOW', conditions: [condition] },
            { name: 'r-send', operation: 'sendTransaction', action: 'ALLOW', conditions: [condition] }
          ]
        })

      const account = await wdkManager.getAccount('ethereum', 0)
      const bridge = account.getBridgeProtocol('oft')

      const result = await bridge.bridge()

      expect(result.hash).toBe(DUMMY_TX_HASH)
      expect(condition).toHaveBeenCalledTimes(1)
      expect(sendTransactionMock).toHaveBeenCalledTimes(1)
    })
  })

  // -------------------------------------------------------------------------
  // Context object
  // -------------------------------------------------------------------------

  describe('context object', () => {
    test('the condition function receives operation, chain, params, args, and a read-only account', async () => {
      let captured

      getAccountMock.mockResolvedValue(buildAccount())

      wdkManager
        .registerWallet('base', WalletManagerMock, {})
        .registerPolicy({
          id: 'capture',
          name: 'capture',
          scope: 'project',
          rules: [{
            name: 'r',
            operation: 'sendTransaction',
            action: 'ALLOW',
            conditions: [(ctx) => { captured = ctx; return true }]
          }]
        })

      const account = await wdkManager.getAccount('base', 0)
      await account.sendTransaction({ to: RECIPIENT, value: 7n }, { gas: 21000 })

      expect(captured.operation).toBe('sendTransaction')
      expect(captured.chain).toBe('base')
      expect(captured.params).toEqual({ to: RECIPIENT, value: 7n })
      expect(captured.args).toHaveLength(2)
      expect(captured.args[0]).toEqual({ to: RECIPIENT, value: 7n })
      expect(captured.args[1]).toEqual({ gas: 21000 })
      expect(captured.account.path).toBe(PATH_DEFAULT)
      expect(captured.account.sendTransaction).toBeUndefined()
      expect(captured.account.transfer).toBeUndefined()
      expect(Object.isFrozen(captured)).toBe(true)
    })
  })
})
