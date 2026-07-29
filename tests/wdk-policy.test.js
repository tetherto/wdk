'use strict'

import { beforeEach, describe, expect, jest, test } from '@jest/globals'

import WalletManager from '@tetherto/wdk-wallet'

import { BridgeProtocol, SdaProtocol, SwapProtocol, SwidgeProtocol } from '@tetherto/wdk-wallet/protocols'

import WDK, { PolicyConfigurationError, PolicyViolationError } from '../index.js'

const SEED_PHRASE = 'cook voyage document eight skate token alien guide drink uncle term abuse'

// Stub return values (DUMMY_ prefix per CQ5).
const DUMMY_TX_HASH = '0xdummy-tx-hash'
const DUMMY_TRANSFER_HASH = '0xdummy-transfer-hash'
const DUMMY_SIGNATURE = '0xdummy-sig'
const DUMMY_BALANCE = 1000n
const DUMMY_QUOTE = { fee: 1n }
const DUMMY_SWAP_RESULT = { hash: '0xdummy-swap-hash' }
const DUMMY_BRIDGE_RESULT = { hash: '0xdummy-bridge-hash' }
const DUMMY_SWIDGE_RESULT = { hash: '0xdummy-swidge-hash' }
const DUMMY_SDA_ADDRESS_RESULT = [{ address: '0xdummy-deposit-address' }]
const DUMMY_SDA_ROUTES = [{ sourceChains: ['arbitrum'], destinationChain: 'polygon' }]
const DUMMY_SIGNED_TX = '0xdummy-signed-tx'

// Test inputs (no DUMMY_ prefix per CQ5). Addresses are valid EVM shape
// (0x + 40 hex) using repeating digits to encode the role at a glance.
const PATH_DEFAULT = "0'/0/0"
const PATH_SECONDARY = "0'/0/1"
const RECIPIENT = '0x1111111111111111111111111111111111111111'
const SANCTIONED = '0x2222222222222222222222222222222222222222'
const SPENDER = '0x3333333333333333333333333333333333333333'
const TOKEN = '0x4444444444444444444444444444444444444444'

// Mock references for the wallet boundary (the only legitimate mock surface).
const sendTransactionMock = jest.fn()
const signTransactionMock = jest.fn()
const transferMock = jest.fn()
const approveMock = jest.fn()
const signMock = jest.fn()
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
  signTransaction: signTransactionMock,
  transfer: transferMock,
  approve: approveMock,
  sign: signMock,
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

describe('WDK — policy engine', () => {
  let wdk

  beforeEach(() => {
    sendTransactionMock.mockReset().mockResolvedValue({ hash: DUMMY_TX_HASH })
    signTransactionMock.mockReset().mockResolvedValue(DUMMY_SIGNED_TX)
    transferMock.mockReset().mockResolvedValue({ hash: DUMMY_TRANSFER_HASH })
    approveMock.mockReset()
    signMock.mockReset().mockResolvedValue(DUMMY_SIGNATURE)
    getBalanceMock.mockReset().mockResolvedValue(DUMMY_BALANCE)
    quoteTransferMock.mockReset().mockResolvedValue(DUMMY_QUOTE)
    getAccountMock.mockReset()
    getAccountByPathMock.mockReset()
    disposeWalletMock.mockReset()

    wdk = new WDK(SEED_PHRASE)
  })

  // -------------------------------------------------------------------------
  // Registration & validation
  // -------------------------------------------------------------------------

  describe('registerPolicy', () => {
    test('returns the WDK instance for chaining', () => {
      wdk.registerWallet('ethereum', WalletManagerMock, {})

      const result = wdk.registerPolicy(projectAllowAll('p'))

      expect(result).toBe(wdk)
    })

    test("accepts a 'wallet' field inside the policy object", () => {
      wdk.registerWallet('ethereum', WalletManagerMock, {})

      const result = wdk.registerPolicy({ ...projectAllowAll('p'), wallet: 'ethereum' })

      expect(result).toBe(wdk)
    })

    test("accepts a 'wallet' field as an array inside the policy object", () => {
      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerWallet('ton', WalletManagerMock, {})

      const result = wdk.registerPolicy({ ...projectAllowAll('p'), wallet: ['ethereum', 'ton'] })

      expect(result).toBe(wdk)
    })

    test('accepts an array of policies', () => {
      wdk.registerWallet('ethereum', WalletManagerMock, {})

      const result = wdk.registerPolicy([projectAllowAll('p1'), projectAllowAll('p2')])

      expect(result).toBe(wdk)
    })

    test('accepts a Phase 2 state option without throwing', () => {
      wdk.registerWallet('ethereum', WalletManagerMock, {})

      const result = wdk.registerPolicy(projectAllowAll('p'), { state: { foo: 'bar' } })

      expect(result).toBe(wdk)
    })

    test('throws PolicyConfigurationError when wallet is not registered', () => {
      const err = catchSync(() => wdk.registerPolicy({ ...projectAllowAll('p'), wallet: 'mars' }))

      expect(err.name).toBe('PolicyConfigurationError')
      expect(err.message).toBe("registerPolicy: no wallet registered with identifier 'mars'.")
    })

    test('throws PolicyConfigurationError when one entry in a wallet array is not registered', () => {
      wdk.registerWallet('ethereum', WalletManagerMock, {})

      const err = catchSync(() => wdk.registerPolicy({ ...projectAllowAll('p'), wallet: ['ethereum', 'mars'] }))

      expect(err.name).toBe('PolicyConfigurationError')
      expect(err.message).toBe("registerPolicy: no wallet registered with identifier 'mars'.")
    })

    test("throws PolicyConfigurationError when 'wallet' is an empty string", () => {
      const err = catchSync(() => wdk.registerPolicy({ ...projectAllowAll('p'), wallet: '' }))

      expect(err.name).toBe('PolicyConfigurationError')
      expect(err.message).toBe("Policy 'p': 'wallet': Too small: expected string to have >=1 characters")
    })

    test("throws PolicyConfigurationError when 'wallet' is an empty array", () => {
      const err = catchSync(() => wdk.registerPolicy({ ...projectAllowAll('p'), wallet: [] }))

      expect(err.name).toBe('PolicyConfigurationError')
      expect(err.message).toBe("Policy 'p': 'wallet': Too small: expected array to have >=1 items")
    })

    test("throws PolicyConfigurationError on missing 'id'", () => {
      wdk.registerWallet('ethereum', WalletManagerMock, {})

      const policy = { name: 'no-id', scope: 'project', rules: [{ name: 'r', operation: 'sendTransaction', action: 'ALLOW', conditions: [] }] }
      const err = catchSync(() => wdk.registerPolicy(policy))

      expect(err.name).toBe('PolicyConfigurationError')
      expect(err.message).toBe("Policy: 'id': Invalid input: expected string, received undefined")
    })

    test("throws PolicyConfigurationError on missing 'name'", () => {
      wdk.registerWallet('ethereum', WalletManagerMock, {})

      const policy = { id: 'p', scope: 'project', rules: [{ name: 'r', operation: 'sendTransaction', action: 'ALLOW', conditions: [] }] }
      const err = catchSync(() => wdk.registerPolicy(policy))

      expect(err.name).toBe('PolicyConfigurationError')
      expect(err.message).toBe("Policy 'p': 'name': Invalid input: expected string, received undefined")
    })

    test('throws PolicyConfigurationError on unknown scope', () => {
      wdk.registerWallet('ethereum', WalletManagerMock, {})

      const policy = { id: 'p', name: 'p', scope: 'global', rules: [{ name: 'r', operation: 'sendTransaction', action: 'ALLOW', conditions: [] }] }
      const err = catchSync(() => wdk.registerPolicy(policy))

      expect(err.name).toBe('PolicyConfigurationError')
      expect(err.message).toBe('Policy \'p\': \'scope\': Invalid option: expected one of "project"|"account"')
    })

    test('throws PolicyConfigurationError on unknown operation', () => {
      wdk.registerWallet('ethereum', WalletManagerMock, {})

      const policy = { id: 'p', name: 'p', scope: 'project', rules: [{ name: 'r', operation: 'fly', action: 'ALLOW', conditions: [] }] }
      const err = catchSync(() => wdk.registerPolicy(policy))

      expect(err.name).toBe('PolicyConfigurationError')
      expect(err.message).toBe("Rule 'r' in policy 'p': 'operation': Invalid input")
    })

    test('throws PolicyConfigurationError on invalid action', () => {
      wdk.registerWallet('ethereum', WalletManagerMock, {})

      const policy = { id: 'p', name: 'p', scope: 'project', rules: [{ name: 'r', operation: 'sendTransaction', action: 'maybe', conditions: [] }] }
      const err = catchSync(() => wdk.registerPolicy(policy))

      expect(err.name).toBe('PolicyConfigurationError')
      expect(err.message).toBe('Rule \'r\' in policy \'p\': \'action\': Invalid option: expected one of "ALLOW"|"DENY"')
    })

    test('throws PolicyConfigurationError on override_broader_scope outside account-scope ALLOW', () => {
      wdk.registerWallet('ethereum', WalletManagerMock, {})

      const policy = { id: 'p', name: 'p', scope: 'project', rules: [{ name: 'r', operation: 'sendTransaction', action: 'ALLOW', override_broader_scope: true, conditions: [] }] }
      const err = catchSync(() => wdk.registerPolicy(policy))

      expect(err.name).toBe('PolicyConfigurationError')
      expect(err.message).toBe("Rule 'r' in policy 'p': 'override_broader_scope': 'override_broader_scope' is only valid on account-scope ALLOW rules")
    })

    test('throws PolicyConfigurationError on non-function condition', () => {
      wdk.registerWallet('ethereum', WalletManagerMock, {})

      const policy = { id: 'p', name: 'p', scope: 'project', rules: [{ name: 'r', operation: 'sendTransaction', action: 'ALLOW', conditions: ['not-a-function'] }] }
      const err = catchSync(() => wdk.registerPolicy(policy))

      expect(err.name).toBe('PolicyConfigurationError')
      expect(err.message).toBe("Rule 'r' in policy 'p': 'conditions.0': Invalid input")
    })

    test("throws PolicyConfigurationError on account-scope without a 'wallet' field", () => {
      wdk.registerWallet('ethereum', WalletManagerMock, {})

      const policy = { id: 'p', name: 'p', scope: 'account', accounts: [PATH_DEFAULT], rules: [{ name: 'r', operation: 'sendTransaction', action: 'ALLOW', conditions: [] }] }
      const err = catchSync(() => wdk.registerPolicy(policy))

      expect(err.name).toBe('PolicyConfigurationError')
      expect(err.message).toBe("Policy 'p': 'wallet': 'wallet' is required when scope is 'account'")
    })

    test('throws PolicyConfigurationError when accounts is provided on non-account scope', () => {
      wdk.registerWallet('ethereum', WalletManagerMock, {})

      const policy = { id: 'p', name: 'p', scope: 'project', accounts: [PATH_DEFAULT], rules: [{ name: 'r', operation: 'sendTransaction', action: 'ALLOW', conditions: [] }] }
      const err = catchSync(() => wdk.registerPolicy(policy))

      expect(err.name).toBe('PolicyConfigurationError')
      expect(err.message).toBe("Policy 'p': 'accounts': 'accounts' is only allowed when scope is 'account'")
    })

    test('does not partially register when one policy in an array is invalid', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      wdk.registerWallet('ethereum', WalletManagerMock, {})

      const good = projectDenyAll('good')
      const bad = { id: 'bad', name: 'bad', scope: 'project', rules: [{ name: 'r', operation: 'fly', action: 'ALLOW', conditions: [] }] }

      const err = catchSync(() => wdk.registerPolicy([good, bad]))

      expect(err.name).toBe('PolicyConfigurationError')
      expect(err.message).toBe("Rule 'r' in policy 'bad': 'operation': Invalid input")

      // The 'good' policy must NOT have been registered (otherwise the next call would block).
      const account = await wdk.getAccount('ethereum', 0)
      const result = await account.sendTransaction({ to: RECIPIENT, value: 1n })

      expect(result.hash).toBe(DUMMY_TX_HASH)
    })

    test('a second registration with the same id replaces the first in the same wallet bucket', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy(projectDenyAll('same-id'))
        .registerPolicy(projectAllowAll('same-id'))

      const account = await wdk.getAccount('ethereum', 0)
      const result = await account.sendTransaction({ to: RECIPIENT, value: 1n })

      expect(result.hash).toBe(DUMMY_TX_HASH)
    })

    test('multiple registerPolicy calls stack and all run', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      const firstCondition = jest.fn().mockReturnValue(true)
      const secondCondition = jest.fn().mockReturnValue(true)

      wdk.registerWallet('ethereum', WalletManagerMock, {})
      wdk.registerPolicy({
        id: 'p1',
        name: 'p1',
        scope: 'project',
        rules: [{ name: 'r1', operation: 'sendTransaction', action: 'ALLOW', conditions: [firstCondition] }]
      })
      wdk.registerPolicy({
        id: 'p2',
        name: 'p2',
        scope: 'project',
        rules: [{ name: 'r2', operation: 'sendTransaction', action: 'ALLOW', conditions: [secondCondition] }]
      })

      const account = await wdk.getAccount('ethereum', 0)
      await account.sendTransaction({ to: RECIPIENT, value: 1n })

      const expectedContext = expect.objectContaining({
        operation: 'sendTransaction',
        wallet: 'ethereum',
        params: { to: RECIPIENT, value: 1n }
      })

      expect(firstCondition).toHaveBeenCalledTimes(1)
      expect(firstCondition).toHaveBeenCalledWith(expectedContext)
      expect(secondCondition).toHaveBeenCalledTimes(1)
      expect(secondCondition).toHaveBeenCalledWith(expectedContext)
    })
  })

  // -------------------------------------------------------------------------
  // Dispose
  // -------------------------------------------------------------------------

  describe('dispose', () => {
    test('disposing a single wallet stops wallet-bound project policies on that wallet after re-register', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy({
          id: 'eth-deny',
          name: 'eth-deny',
          scope: 'project',
          wallet: 'ethereum',
          rules: [{ name: 'deny', operation: 'sendTransaction', action: 'DENY', conditions: [] }]
        })

      wdk.dispose(['ethereum'])
      wdk.registerWallet('ethereum', WalletManagerMock, {})

      const account = await wdk.getAccount('ethereum', 0)
      const result = await account.sendTransaction({ to: RECIPIENT, value: 1n })

      expect(result.hash).toBe(DUMMY_TX_HASH)
    })

    test('dispose() with no arguments clears project-scope policies too', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy(projectDenyAll('proj-deny'))

      wdk.dispose()
      wdk.registerWallet('ethereum', WalletManagerMock, {})

      const account = await wdk.getAccount('ethereum', 0)
      const result = await account.sendTransaction({ to: RECIPIENT, value: 1n })

      expect(result.hash).toBe(DUMMY_TX_HASH)
    })

    test('disposing one wallet narrows a multi-wallet project policy and leaves other wallets intact', async () => {
      getAccountMock.mockImplementation(async () => buildAccount())

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerWallet('ton', WalletManagerMock, {})
        .registerPolicy({
          id: 'multi-chain',
          name: 'multi-chain',
          scope: 'project',
          wallet: ['ethereum', 'ton'],
          rules: [{ name: 'deny', operation: 'sendTransaction', action: 'DENY', conditions: [] }]
        })

      wdk.dispose(['ethereum'])
      wdk.registerWallet('ethereum', WalletManagerMock, {})

      // ton policy should still be active.
      const tonAccount = await wdk.getAccount('ton', 0)
      const err = await catchAsync(() => tonAccount.sendTransaction({ to: RECIPIENT, value: 1n }))

      expect(err.name).toBe('PolicyViolationError')
      expect(err.policyId).toBe('multi-chain')

      // ethereum should be unguarded again.
      const ethAccount = await wdk.getAccount('ethereum', 0)
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

      wdk.registerWallet('ethereum', WalletManagerMock, {})

      const account = await wdk.getAccount('ethereum', 0)

      expect(account.simulate).toBeUndefined()
    })

    test('every OPERATIONS method on a governed account is wrapped; unaddressed ops BLOCK', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy(projectDenyAll('only-send'))

      const account = await wdk.getAccount('ethereum', 0)

      // sendTransaction is addressed by the rule → DENY by the rule.
      const denied = await catchAsync(() => account.sendTransaction({ to: RECIPIENT, value: 1n }))
      expect(denied.name).toBe('PolicyViolationError')
      expect(denied.policyId).toBe('only-send')

      // transfer is also wrapped (full OPERATIONS coverage on governed accounts);
      // no rule addresses it → BLOCK with `no-applicable-rule`. This is the
      // default-deny semantic that closes the sibling-method bypass: a
      // "cap transfer" policy cannot be sidestepped by calling sendTransaction
      // with ERC-20 calldata, signTypedData for a Permit, etc.
      const transferErr = await catchAsync(() => account.transfer({ token: TOKEN, recipient: RECIPIENT, amount: 1n }))
      expect(transferErr.name).toBe('PolicyViolationError')
      expect(transferErr.reason).toBe('no-applicable-rule')
      expect(transferMock).not.toHaveBeenCalled()

      // simulate mirrors every wrapped op; calling each returns a structured
      // verdict matching the rule (or no-applicable-rule for unaddressed ops).
      const simSend = await account.simulate.sendTransaction({ to: RECIPIENT, value: 1n })
      const simTransfer = await account.simulate.transfer({ token: TOKEN, recipient: RECIPIENT, amount: 1n })

      expect(simSend.decision).toBe('DENY')
      expect(simSend.policy_id).toBe('only-send')
      expect(simTransfer.decision).toBe('DENY')
      expect(simTransfer.reason).toBe('no-applicable-rule')
    })

    test('read-only methods (getBalance, quoteTransfer) are not wrapped or mirrored in simulate', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy(projectDenyAll('only-send'))

      const account = await wdk.getAccount('ethereum', 0)

      const balance = await account.getBalance()
      expect(balance).toBe(DUMMY_BALANCE)

      const quote = await account.quoteTransfer({ token: TOKEN, recipient: RECIPIENT, amount: 1n })
      expect(quote).toEqual(DUMMY_QUOTE)

      expect(account.simulate.getBalance).toBeUndefined()
      expect(account.simulate.quoteTransfer).toBeUndefined()
    })
  })

  // -------------------------------------------------------------------------
  // Coverage of every signing/value-moving primitive on IWalletAccount
  //
  // The policy engine wraps methods named in OPERATIONS that also exist on
  // the underlying account. If OPERATIONS or the names diverge from the
  // canonical IWalletAccount API, a policy registers but silently no-ops,
  // which is worse than throwing — these tests pin the contract.
  // -------------------------------------------------------------------------

  describe('IWalletAccount surface coverage', () => {
    test('DENY on signTransaction blocks proxy.signTransaction', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy({
          id: 'no-sign-tx',
          name: 'no-sign-tx',
          scope: 'project',
          rules: [{ name: 'deny-sign-tx', operation: 'signTransaction', action: 'DENY', conditions: [] }]
        })

      const account = await wdk.getAccount('ethereum', 0)
      const err = await catchAsync(() => account.signTransaction({ to: SANCTIONED, value: 1n }))

      expect(err.name).toBe('PolicyViolationError')
      expect(err.policyId).toBe('no-sign-tx')
      expect(signTransactionMock).not.toHaveBeenCalled()
    })

    test('wildcard * also catches signTransaction', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy({
          id: 'block-all',
          name: 'block-all',
          scope: 'project',
          rules: [{ name: 'deny-all', operation: '*', action: 'DENY', conditions: [] }]
        })

      const account = await wdk.getAccount('ethereum', 0)
      const err = await catchAsync(() => account.signTransaction({ to: SANCTIONED, value: 1n }))

      expect(err.name).toBe('PolicyViolationError')
      expect(err.ruleName).toBe('deny-all')
      expect(signTransactionMock).not.toHaveBeenCalled()
    })

    test('ALLOW signTransaction forwards the original tx through to the wallet', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy({
          id: 'allow-sign-tx',
          name: 'allow-sign-tx',
          scope: 'project',
          rules: [{ name: 'r', operation: 'signTransaction', action: 'ALLOW', conditions: [] }]
        })

      const account = await wdk.getAccount('ethereum', 0)
      const signed = await account.signTransaction({ to: RECIPIENT, value: 1n })

      expect(signed).toBe(DUMMY_SIGNED_TX)
      expect(signTransactionMock).toHaveBeenCalledWith({ to: RECIPIENT, value: 1n })
    })

    test('DENY on sign blocks proxy.sign (the IWalletAccount method is sign, not signMessage)', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy({
          id: 'no-sign',
          name: 'no-sign',
          scope: 'project',
          rules: [{ name: 'deny-sign', operation: 'sign', action: 'DENY', conditions: [] }]
        })

      const account = await wdk.getAccount('ethereum', 0)
      const err = await catchAsync(() => account.sign('hello'))

      expect(err.name).toBe('PolicyViolationError')
      expect(err.policyId).toBe('no-sign')
      expect(signMock).not.toHaveBeenCalled()
    })

    test('signMessage and signHash are rejected at registration as unknown operations', () => {
      const wrong = (op) => ({
        id: 'p',
        name: 'p',
        scope: 'project',
        rules: [{ name: 'r', operation: op, action: 'DENY', conditions: [] }]
      })

      const errMsg = catchSync(() => wdk.registerPolicy(wrong('signMessage')))
      const errHash = catchSync(() => wdk.registerPolicy(wrong('signHash')))

      expect(errMsg.name).toBe('PolicyConfigurationError')
      expect(errMsg.message).toBe("Rule 'r' in policy 'p': 'operation': Invalid input")
      expect(errHash.name).toBe('PolicyConfigurationError')
      expect(errHash.message).toBe("Rule 'r' in policy 'p': 'operation': Invalid input")
    })
  })

  // -------------------------------------------------------------------------
  // Default-deny: sibling-method bypass coverage
  //
  // A policy that names one money-movement op must not be sidesteppable by
  // calling a different op that moves the same value (ERC-20 transfer via
  // sendTransaction calldata, signTypedData for Permit, delegate for 7702,
  // etc.). The engine default-denies any unaddressed op on a governed account.
  // -------------------------------------------------------------------------

  describe('default-deny: sibling-method bypass coverage', () => {
    test('a "cap transfer" policy also blocks sendTransaction (same funds via raw calldata)', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy({
          id: 'cap-transfer',
          name: 'cap-transfer',
          scope: 'project',
          rules: [{
            name: 'cap',
            operation: 'transfer',
            action: 'ALLOW',
            conditions: [({ params }) => BigInt(params.amount) <= 100n]
          }]
        })

      const account = await wdk.getAccount('ethereum', 0)
      // Attacker tries to move tokens via the underlying-tx path instead of `transfer`.
      const err = await catchAsync(() => account.sendTransaction({ to: TOKEN, value: 0n, data: '0xa9059cbb...' }))

      expect(err.name).toBe('PolicyViolationError')
      expect(err.reason).toBe('no-applicable-rule')
      expect(sendTransactionMock).not.toHaveBeenCalled()
    })

    test('a "cap transfer" policy also blocks approve (spender pulls)', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy({
          id: 'cap-transfer',
          name: 'cap-transfer',
          scope: 'project',
          rules: [{ name: 'cap', operation: 'transfer', action: 'ALLOW', conditions: [() => true] }]
        })

      const account = await wdk.getAccount('ethereum', 0)
      const err = await catchAsync(() => account.approve({ token: TOKEN, spender: SPENDER, amount: 1n }))

      expect(err.name).toBe('PolicyViolationError')
      expect(err.reason).toBe('no-applicable-rule')
      expect(approveMock).not.toHaveBeenCalled()
    })

    test('a "cap transfer" policy also blocks signTypedData (off-chain Permit)', async () => {
      getAccountMock.mockResolvedValue(buildAccount(PATH_DEFAULT, {
        signTypedData: jest.fn().mockResolvedValue('0xpermit-sig')
      }))

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy({
          id: 'cap-transfer',
          name: 'cap-transfer',
          scope: 'project',
          rules: [{ name: 'cap', operation: 'transfer', action: 'ALLOW', conditions: [() => true] }]
        })

      const account = await wdk.getAccount('ethereum', 0)
      const err = await catchAsync(() => account.signTypedData({ domain: {}, types: {}, message: {} }))

      expect(err.name).toBe('PolicyViolationError')
      expect(err.reason).toBe('no-applicable-rule')
    })

    test('a "cap transfer" policy also blocks delegate (ERC-7702 EOA delegation)', async () => {
      getAccountMock.mockResolvedValue(buildAccount(PATH_DEFAULT, {
        delegate: jest.fn().mockResolvedValue({ hash: '0xdummy-delegate-hash' })
      }))

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy({
          id: 'cap-transfer',
          name: 'cap-transfer',
          scope: 'project',
          rules: [{ name: 'cap', operation: 'transfer', action: 'ALLOW', conditions: [() => true] }]
        })

      const account = await wdk.getAccount('ethereum', 0)
      const err = await catchAsync(() => account.delegate('0xdelegate'))

      expect(err.name).toBe('PolicyViolationError')
      expect(err.reason).toBe('no-applicable-rule')
    })

    test('an account with no policies is not governed; the proxy is not even applied', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      wdk.registerWallet('ethereum', WalletManagerMock, {})

      const account = await wdk.getAccount('ethereum', 0)

      // No proxy → no enforcement → sibling-method semantics unchanged for
      // ungoverned accounts. This preserves the zero-cost path when no
      // consumer cares about policies.
      expect(account.simulate).toBeUndefined()

      const result = await account.transfer({ token: TOKEN, recipient: RECIPIENT, amount: 1n })
      expect(result.hash).toBe(DUMMY_TRANSFER_HASH)
    })
  })

  // -------------------------------------------------------------------------
  // Internal-reference containment
  // -------------------------------------------------------------------------

  describe('internal-reference containment', () => {
    test('key material (keyPair) is not reachable through a governed account', async () => {
      getAccountMock.mockResolvedValue(buildAccount(PATH_DEFAULT, {
        keyPair: { privateKey: new Uint8Array([1, 2, 3]) }
      }))

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy(projectAllowAll('p'))

      const account = await wdk.getAccount('ethereum', 0)

      expect(account.keyPair).toBeUndefined()
    })

    test('internal references (_signer, _provider, _config) are not reachable through a governed account', async () => {
      getAccountMock.mockResolvedValue(buildAccount(PATH_DEFAULT, {
        _signer: { signTransaction: jest.fn() },
        _provider: { send: jest.fn() },
        _config: { transactionMaxFee: 1n }
      }))

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy(projectAllowAll('p'))

      const account = await wdk.getAccount('ethereum', 0)

      expect(account._signer).toBeUndefined()
      expect(account._provider).toBeUndefined()
      expect(account._config).toBeUndefined()
    })

    test('hiding internal references leaves safe reads and enforced operations working', async () => {
      getAccountMock.mockResolvedValue(buildAccount(PATH_DEFAULT, {
        _signer: { signTransaction: jest.fn() }
      }))

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy(projectAllowAll('p'))

      const account = await wdk.getAccount('ethereum', 0)

      expect(account._signer).toBeUndefined()
      expect(account.path).toBe(PATH_DEFAULT)
      expect(await account.getBalance()).toBe(DUMMY_BALANCE)

      const result = await account.sendTransaction({ to: RECIPIENT, value: 1n })
      expect(result.hash).toBe(DUMMY_TX_HASH)
    })

    test("a protocol's raw-account back-reference (_account) is not reachable through the protocol proxy", async () => {
      const swapInstanceMock = jest.fn().mockResolvedValue(DUMMY_SWAP_RESULT)

      class MySwapProtocol extends SwapProtocol {
        constructor (account) { super(); this._account = account }
        async swap (opts) { return swapInstanceMock(opts) }
      }

      getAccountMock.mockResolvedValue(buildAccount())

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerProtocol('ethereum', 'velora', MySwapProtocol, {})
        .registerPolicy({
          id: 'no-swaps',
          name: 'no-swaps',
          scope: 'project',
          rules: [{ name: 'deny-swap', operation: 'swap', action: 'DENY', conditions: [] }]
        })

      const account = await wdk.getAccount('ethereum', 0)
      const swap = account.getSwapProtocol('velora')

      expect(swap._account).toBeUndefined()

      const denied = await catchAsync(() => swap.swap({ tokenIn: 'A', tokenOut: 'B', tokenInAmount: 1n }))
      expect(denied.name).toBe('PolicyViolationError')
      expect(swapInstanceMock).not.toHaveBeenCalled()
    })

    test('property descriptors do not carry internal references on a governed account', async () => {
      getAccountMock.mockResolvedValue(buildAccount(PATH_DEFAULT, {
        keyPair: { privateKey: new Uint8Array([1, 2, 3]) },
        _signer: { signTransaction: jest.fn() },
        _provider: { send: jest.fn() }
      }))

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy(projectAllowAll('p'))

      const account = await wdk.getAccount('ethereum', 0)

      expect(Object.getOwnPropertyDescriptor(account, '_signer')).toBeUndefined()
      expect(Object.getOwnPropertyDescriptor(account, '_provider')).toBeUndefined()
      expect(Object.getOwnPropertyDescriptor(account, 'keyPair')).toBeUndefined()
      expect(Object.getOwnPropertyDescriptors(account)).not.toHaveProperty('_signer')
    })

    test('membership tests and key enumeration do not reveal internal references on a governed account', async () => {
      getAccountMock.mockResolvedValue(buildAccount(PATH_DEFAULT, {
        _signer: { signTransaction: jest.fn() },
        _provider: { send: jest.fn() }
      }))

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy(projectAllowAll('p'))

      const account = await wdk.getAccount('ethereum', 0)

      expect('_signer' in account).toBe(false)
      expect('_provider' in account).toBe(false)
      expect('keyPair' in account).toBe(false)
      expect(Reflect.ownKeys(account)).not.toContain('_signer')
      expect(Reflect.ownKeys(account)).not.toContain('_provider')
      expect(Reflect.ownKeys(account)).toContain('path')
      expect(Reflect.ownKeys(account)).toContain('sendTransaction')
    })

    test('a descriptor read of a wrapped operation yields the enforced method, not the raw one', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy(projectDenyAll('deny'))

      const account = await wdk.getAccount('ethereum', 0)

      const descriptor = Object.getOwnPropertyDescriptor(account, 'sendTransaction')

      const denied = await catchAsync(() => descriptor.value({ to: RECIPIENT, value: 1n }))

      expect(denied.name).toBe('PolicyViolationError')
      expect(sendTransactionMock).not.toHaveBeenCalled()
    })

    test('a descriptor read of a protocol getter yields the enforced getter, not the raw one', async () => {
      const swapInstanceMock = jest.fn().mockResolvedValue(DUMMY_SWAP_RESULT)

      class MySwapProtocol extends SwapProtocol {
        constructor (account) { super(); this._account = account }
        async swap (opts) { return swapInstanceMock(opts) }
      }

      getAccountMock.mockResolvedValue(buildAccount())

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerProtocol('ethereum', 'velora', MySwapProtocol, {})
        .registerPolicy({
          id: 'no-swaps',
          name: 'no-swaps',
          scope: 'project',
          rules: [{ name: 'deny-swap', operation: 'swap', action: 'DENY', conditions: [] }]
        })

      const account = await wdk.getAccount('ethereum', 0)

      const descriptor = Object.getOwnPropertyDescriptor(account, 'getSwapProtocol')

      const swap = descriptor.value('velora')

      const denied = await catchAsync(() => swap.swap({ tokenIn: 'A', tokenOut: 'B', tokenInAmount: 1n }))

      expect(denied.name).toBe('PolicyViolationError')
      expect(swapInstanceMock).not.toHaveBeenCalled()
    })

    test("descriptors, membership tests and key enumeration do not reveal a protocol's raw-account back-reference", async () => {
      class MySwapProtocol extends SwapProtocol {
        constructor (account) { super(); this._account = account }
        async swap () { return DUMMY_SWAP_RESULT }
      }

      getAccountMock.mockResolvedValue(buildAccount())

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerProtocol('ethereum', 'velora', MySwapProtocol, {})
        .registerPolicy(projectAllowAll('p'))

      const account = await wdk.getAccount('ethereum', 0)
      const swap = account.getSwapProtocol('velora')

      expect(Object.getOwnPropertyDescriptor(swap, '_account')).toBeUndefined()
      expect('_account' in swap).toBe(false)
      expect(Reflect.ownKeys(swap)).not.toContain('_account')
    })

    test('a governed account cannot be made non-extensible', async () => {
      getAccountMock.mockResolvedValue(buildAccount(PATH_DEFAULT, {
        _signer: { signTransaction: jest.fn() }
      }))

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy(projectAllowAll('p'))

      const account = await wdk.getAccount('ethereum', 0)

      expect(() => Object.preventExtensions(account)).toThrow(TypeError)
      expect(() => Object.freeze(account)).toThrow(TypeError)
      expect(Object.getOwnPropertyDescriptor(account, '_signer')).toBeUndefined()
      expect(Reflect.ownKeys(account)).not.toContain('_signer')
    })

    test('the simulation mirror is reported as a member of a governed account', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy(projectAllowAll('p'))

      const account = await wdk.getAccount('ethereum', 0)

      expect('simulate' in account).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // PolicyViolationError shape
  // -------------------------------------------------------------------------

  describe('PolicyViolationError', () => {
    test('thrown on DENY carries name, policyId, ruleName, reason, and message', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy({
          id: 'block-eth',
          name: 'Block Ethereum sends',
          scope: 'project',
          rules: [{ name: 'deny-all', operation: 'sendTransaction', action: 'DENY', conditions: [] }]
        })

      const account = await wdk.getAccount('ethereum', 0)
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

      wdk
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

      const account = await wdk.getAccount('ethereum', 0)
      const err = await catchAsync(() => account.sendTransaction({ to: RECIPIENT, value: 1n }))

      expect(err.name).toBe('PolicyViolationError')
      expect(err.policyId).toBe('platform-denylist')
      expect(err.ruleName).toBe('block-bad-recipient')
      expect(err.reason).toBe('recipient is on the sanctioned address list')
      expect(err.message).toBe('Policy violation: platform-denylist/block-bad-recipient: recipient is on the sanctioned address list')
    })

    test('reason is "governed-but-unmatched" when an operation has policies but no rule matches', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      wdk
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

      const account = await wdk.getAccount('ethereum', 0)
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

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy({
          id: 'send-only',
          name: 'send-only',
          scope: 'project',
          rules: [{ name: 'r', operation: 'sendTransaction', action: 'DENY', conditions: [] }]
        })

      const account = await wdk.getAccount('ethereum', 0)
      const err = await catchAsync(() => account.sign('hello'))

      // sign is in OPERATIONS but no rule addresses it → BLOCK with
      // `no-applicable-rule` (the default-deny semantic, not the old default-allow).
      expect(err.name).toBe('PolicyViolationError')
      expect(err.reason).toBe('no-applicable-rule')
      expect(signMock).not.toHaveBeenCalled()
    })

    test('a wildcard ALLOW rule re-enables permissive semantics (opt-out for default-deny)', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy({
          id: 'permissive-baseline',
          name: 'permissive-baseline',
          scope: 'project',
          rules: [
            { name: 'allow-all', operation: '*', action: 'ALLOW', conditions: [] },
            { name: 'block-send', operation: 'sendTransaction', action: 'DENY', conditions: [] }
          ]
        })

      const account = await wdk.getAccount('ethereum', 0)

      // sendTransaction blocked by the DENY rule (DENY wins over wildcard ALLOW within a policy)
      const sendErr = await catchAsync(() => account.sendTransaction({ to: RECIPIENT, value: 1n }))
      expect(sendErr.reason).toBe('block-send')

      // sign and transfer are caught by wildcard ALLOW → pass through
      const sig = await account.sign('hello')
      expect(sig).toBe(DUMMY_SIGNATURE)

      const transferResult = await account.transfer({ token: TOKEN, recipient: RECIPIENT, amount: 1n })
      expect(transferResult.hash).toBe(DUMMY_TRANSFER_HASH)
    })

    test('project ALLOW with conditions true permits the operation', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      wdk
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

      const account = await wdk.getAccount('ethereum', 0)
      const result = await account.sendTransaction({ to: RECIPIENT, value: 3n })

      expect(result.hash).toBe(DUMMY_TX_HASH)
    })

    test('multi-rule policy: a DENY at rule index 0 wins over an ALLOW at rule index 1', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      wdk
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

      const account = await wdk.getAccount('ethereum', 0)
      const err = await catchAsync(() => account.sendTransaction({ to: RECIPIENT, value: 1n }))

      expect(err.name).toBe('PolicyViolationError')
      expect(err.ruleName).toBe('always-deny')
    })

    test('an operation array on a rule matches each listed name', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy({
          id: 'multi-op',
          name: 'multi-op',
          scope: 'project',
          rules: [{ name: 'deny-pair', operation: ['sendTransaction', 'transfer'], action: 'DENY', conditions: [] }]
        })

      const account = await wdk.getAccount('ethereum', 0)
      const sendErr = await catchAsync(() => account.sendTransaction({ to: RECIPIENT, value: 1n }))
      const transferErr = await catchAsync(() => account.transfer({ token: TOKEN, recipient: RECIPIENT, amount: 1n }))

      expect(sendErr.name).toBe('PolicyViolationError')
      expect(sendErr.ruleName).toBe('deny-pair')
      expect(transferErr.name).toBe('PolicyViolationError')
      expect(transferErr.ruleName).toBe('deny-pair')

      // sign is in OPERATIONS but not addressed by any rule → BLOCK with no-applicable-rule.
      const sigErr = await catchAsync(() => account.sign('hi'))
      expect(sigErr.reason).toBe('no-applicable-rule')
    })

    test('the wildcard * matches any operation', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy({
          id: 'star',
          name: 'star',
          scope: 'project',
          rules: [{ name: 'block-all', operation: '*', action: 'DENY', conditions: [] }]
        })

      const account = await wdk.getAccount('ethereum', 0)
      const sendErr = await catchAsync(() => account.sendTransaction({ to: RECIPIENT, value: 1n }))
      const sigErr = await catchAsync(() => account.sign('hi'))

      expect(sendErr.name).toBe('PolicyViolationError')
      expect(sendErr.ruleName).toBe('block-all')
      expect(sigErr.name).toBe('PolicyViolationError')
      expect(sigErr.ruleName).toBe('block-all')
    })

    test('an async condition is awaited before the underlying method runs', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      const order = []
      sendTransactionMock.mockImplementation(async () => { order.push('send'); return { hash: DUMMY_TX_HASH } })

      wdk
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

      const account = await wdk.getAccount('ethereum', 0)
      await account.sendTransaction({ to: RECIPIENT, value: 1n })

      expect(order).toEqual(['cond', 'send'])
    })

    test('a stateful condition holding a counter in closure enforces a rolling cap', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      let totalSpent = 0n
      const cap = 100n

      wdk
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

      const account = await wdk.getAccount('ethereum', 0)
      const ok1 = await account.sendTransaction({ to: RECIPIENT, value: 30n })
      const ok2 = await account.sendTransaction({ to: RECIPIENT, value: 50n })
      const blocked = await catchAsync(() => account.sendTransaction({ to: RECIPIENT, value: 30n }))

      expect(ok1.hash).toBe(DUMMY_TX_HASH)
      expect(ok2.hash).toBe(DUMMY_TX_HASH)
      expect(totalSpent).toBe(80n)
      expect(blocked.name).toBe('PolicyViolationError')
      expect(blocked.reason).toBe('governed-but-unmatched')
      expect(sendTransactionMock).toHaveBeenCalledTimes(2)
      expect(sendTransactionMock).toHaveBeenNthCalledWith(1, { to: RECIPIENT, value: 30n })
      expect(sendTransactionMock).toHaveBeenNthCalledWith(2, { to: RECIPIENT, value: 50n })
    })

    test('a throwing condition is treated as a non-match and recorded in the simulate trace', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      wdk
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

      const account = await wdk.getAccount('ethereum', 0)
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
    test('a wallet-bound project DENY shadows an account-scope ALLOW (no override)', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy({
          id: 'account-allow',
          name: 'account-allow',
          scope: 'account',
          wallet: 'ethereum',
          accounts: [PATH_DEFAULT],
          rules: [{ name: 'allow', operation: 'sendTransaction', action: 'ALLOW', conditions: [] }]
        })
        .registerPolicy({
          id: 'eth-deny',
          name: 'eth-deny',
          scope: 'project',
          wallet: 'ethereum',
          rules: [{ name: 'edeny', operation: 'sendTransaction', action: 'DENY', conditions: [] }]
        })

      const account = await wdk.getAccount('ethereum', 0)
      const err = await catchAsync(() => account.sendTransaction({ to: RECIPIENT, value: 1n }))

      expect(err.name).toBe('PolicyViolationError')
      expect(err.policyId).toBe('eth-deny')
      expect(err.ruleName).toBe('edeny')
    })

    test('a project-scope DENY shadows an account-scope ALLOW recorded without override', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy({
          id: 'agent-limits',
          name: 'agent-limits',
          scope: 'account',
          wallet: 'ethereum',
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

      const account = await wdk.getAccount('ethereum', 0)
      const err = await catchAsync(() => account.sendTransaction({ to: SANCTIONED, value: 50n }))

      expect(err.name).toBe('PolicyViolationError')
      expect(err.policyId).toBe('platform-denylist')
      expect(err.ruleName).toBe('block-bad')
    })

    test('an account-scope ALLOW with override_broader_scope skips both wallet-bound and global project DENYs', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy({
          id: 'treasury',
          name: 'treasury',
          scope: 'account',
          wallet: 'ethereum',
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
          id: 'eth-deny',
          name: 'eth-deny',
          scope: 'project',
          wallet: 'ethereum',
          rules: [{ name: 'edeny', operation: 'sendTransaction', action: 'DENY', conditions: [] }]
        })
        .registerPolicy({
          id: 'global-deny',
          name: 'global-deny',
          scope: 'project',
          rules: [{ name: 'gdeny', operation: 'sendTransaction', action: 'DENY', conditions: [] }]
        })

      const account = await wdk.getAccount('ethereum', 0)
      const result = await account.sendTransaction({ to: RECIPIENT, value: 50n })

      expect(result.hash).toBe(DUMMY_TX_HASH)
    })

    test('the override only engages when the account-scope rule actually matches; otherwise broader DENY fires', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy({
          id: 'treasury',
          name: 'treasury',
          scope: 'account',
          wallet: 'ethereum',
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

      const account = await wdk.getAccount('ethereum', 0)
      // value over the override limit → account rule does NOT match → project DENY fires.
      const err = await catchAsync(() => account.sendTransaction({ to: SANCTIONED, value: 500n }))

      expect(err.name).toBe('PolicyViolationError')
      expect(err.policyId).toBe('platform-denylist')
    })

    test('account-scope policies only engage for accounts whose path is in the accounts array', async () => {
      getAccountByPathMock.mockImplementation(async (path) => buildAccount(path))

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy({
          id: 'agent-deny',
          name: 'agent-deny',
          scope: 'account',
          wallet: 'ethereum',
          accounts: [PATH_SECONDARY],
          rules: [{ name: 'deny', operation: 'sendTransaction', action: 'DENY', conditions: [] }]
        })

      const guarded = await wdk.getAccountByPath('ethereum', PATH_SECONDARY)
      const free = await wdk.getAccountByPath('ethereum', PATH_DEFAULT)

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

  describe('multi-wallet registration', () => {
    test('registerPolicy with a wallet array binds the same policy to each wallet independently', async () => {
      getAccountMock.mockImplementation(async () => buildAccount())

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerWallet('ton', WalletManagerMock, {})
        .registerPolicy({
          id: 'multi',
          name: 'multi',
          scope: 'project',
          wallet: ['ethereum', 'ton'],
          rules: [{ name: 'deny', operation: 'sendTransaction', action: 'DENY', conditions: [] }]
        })

      const eth = await wdk.getAccount('ethereum', 0)
      const ton = await wdk.getAccount('ton', 0)
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

      wdk
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

      const account = await wdk.getAccount('ethereum', 0)
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

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy({
          id: 'block-eth',
          name: 'block-eth',
          scope: 'project',
          rules: [{ name: 'deny-all', operation: 'sendTransaction', action: 'DENY', conditions: [] }]
        })

      const account = await wdk.getAccount('ethereum', 0)
      const result = await account.simulate.sendTransaction({ to: RECIPIENT, value: 1n })

      expect(result.decision).toBe('DENY')
      expect(result.policy_id).toBe('block-eth')
      expect(result.matched_rule).toBe('deny-all')
      expect(result.reason).toBe('deny-all')
      expect(result.trace).toHaveLength(1)
      expect(sendTransactionMock).not.toHaveBeenCalled()
    })

    test('simulate.<op> on an unaddressed op returns DENY with no-applicable-rule', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy(projectAllowAll('only-send'))

      const account = await wdk.getAccount('ethereum', 0)

      // Every OPERATIONS method present on the account is mirrored on
      // governed accounts. Calling each via simulate returns a verdict:
      // sign is unaddressed → no-applicable-rule; sendTransaction is the
      // only-send ALLOW rule → matched.
      const simSign = await account.simulate.sign('hello')
      const simSend = await account.simulate.sendTransaction({ to: RECIPIENT, value: 1n })

      expect(simSign.decision).toBe('DENY')
      expect(simSign.policy_id).toBeNull()
      expect(simSign.matched_rule).toBeNull()
      expect(simSign.reason).toBe('no-applicable-rule')
      expect(simSend.decision).toBe('ALLOW')
      expect(simSend.policy_id).toBe('only-send')
      expect(signMock).not.toHaveBeenCalled()
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

      wdk
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

      const account = await wdk.getAccount('ethereum', 0)
      await account.approve({ token: TOKEN, spender: SPENDER, amount: 1n })

      expect(condition).toHaveBeenCalledTimes(1)
      expect(condition).toHaveBeenCalledWith(expect.objectContaining({
        operation: 'approve',
        wallet: 'ethereum',
        params: { token: TOKEN, spender: SPENDER, amount: 1n }
      }))
      expect(sendTransactionMock).toHaveBeenCalledTimes(1)
      expect(sendTransactionMock).toHaveBeenCalledWith({ to: SPENDER, value: 0n })
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

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy({
          id: 'concurrency',
          name: 'concurrency',
          scope: 'project',
          rules: [{ name: 'r', operation: 'sendTransaction', action: 'ALLOW', conditions: [condition] }]
        })

      const account = await wdk.getAccount('ethereum', 0)

      const [resultA, resultB] = await Promise.all([
        account.sendTransaction({ to: RECIPIENT, value: 1n }),
        account.sendTransaction({ to: RECIPIENT, value: 2n })
      ])

      expect(resultA.hash).toBe(DUMMY_TX_HASH)
      expect(resultB.hash).toBe(DUMMY_TX_HASH)
      expect(condition).toHaveBeenCalledTimes(2)
      expect(condition).toHaveBeenNthCalledWith(1, expect.objectContaining({
        operation: 'sendTransaction',
        wallet: 'ethereum',
        params: { to: RECIPIENT, value: 1n }
      }))
      expect(condition).toHaveBeenNthCalledWith(2, expect.objectContaining({
        operation: 'sendTransaction',
        wallet: 'ethereum',
        params: { to: RECIPIENT, value: 2n }
      }))
      expect(sendTransactionMock).toHaveBeenCalledTimes(2)
      expect(sendTransactionMock).toHaveBeenNthCalledWith(1, { to: RECIPIENT, value: 1n })
      expect(sendTransactionMock).toHaveBeenNthCalledWith(2, { to: RECIPIENT, value: 2n })
    })

    test('concurrent calls under a DENY policy both throw PolicyViolationError', async () => {
      sendTransactionMock.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
        return { hash: DUMMY_TX_HASH }
      })

      getAccountMock.mockResolvedValue(buildAccount())

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy({
          id: 'concurrency-deny',
          name: 'concurrency-deny',
          scope: 'project',
          rules: [{ name: 'deny', operation: 'sendTransaction', action: 'DENY', conditions: [() => true] }]
        })

      const account = await wdk.getAccount('ethereum', 0)

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
    const ATTACKER_VALUE = 1_000_000_000_000_000_000n

    test('mutating the params object after the call starts does not change what conditions saw', async () => {
      let observedTo

      // Slow async condition gives the user time to mutate the original object.
      const condition = jest.fn(async ({ params }) => {
        await new Promise((resolve) => setTimeout(resolve, 30))
        observedTo = params.to
        return true
      })

      getAccountMock.mockResolvedValue(buildAccount())

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy({
          id: 'capture-to',
          name: 'capture-to',
          scope: 'project',
          rules: [{ name: 'r', operation: 'sendTransaction', action: 'ALLOW', conditions: [condition] }]
        })

      const account = await wdk.getAccount('ethereum', 0)

      const tx = { to: RECIPIENT, value: 1n }
      const callPromise = account.sendTransaction(tx)
      tx.to = SANCTIONED // user mutates after starting the call

      await callPromise

      expect(observedTo).toBe(RECIPIENT)
    })

    test('mutating the tx after the call starts does not change what the wallet receives', async () => {
      const condition = jest.fn(async ({ params }) => {
        await new Promise((resolve) => setTimeout(resolve, 30))
        return params.to === RECIPIENT && params.value <= 5n
      })

      getAccountMock.mockResolvedValue(buildAccount())

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy({
          id: 'safe-recipient',
          name: 'safe-recipient',
          scope: 'project',
          rules: [{ name: 'r', operation: 'sendTransaction', action: 'ALLOW', conditions: [condition] }]
        })

      const account = await wdk.getAccount('ethereum', 0)

      const tx = { to: RECIPIENT, value: 1n }
      const callPromise = account.sendTransaction(tx)

      tx.to = SANCTIONED
      tx.value = ATTACKER_VALUE

      await callPromise

      expect(sendTransactionMock).toHaveBeenCalledWith({ to: RECIPIENT, value: 1n })
    })

    test('an argument whose getter returns different values per read cannot split the check from execution', async () => {
      let evaluatedValue
      const condition = jest.fn(({ params }) => {
        evaluatedValue = params.value
        return true
      })

      getAccountMock.mockResolvedValue(buildAccount())

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy({
          id: 'capture-value',
          name: 'capture-value',
          scope: 'project',
          rules: [{ name: 'r', operation: 'sendTransaction', action: 'ALLOW', conditions: [condition] }]
        })

      const account = await wdk.getAccount('ethereum', 0)

      let reads = 0
      const tx = {
        to: RECIPIENT,
        get value () { reads += 1; return reads === 1 ? 1n : ATTACKER_VALUE }
      }
      await account.sendTransaction(tx)

      expect(evaluatedValue).toBe(1n)
      expect(sendTransactionMock).toHaveBeenCalledWith({ to: RECIPIENT, value: 1n })
    })

    test('a condition function cannot mutate its way into the underlying call', async () => {
      const condition = jest.fn(({ params }) => {
        params.to = SANCTIONED // mutation should not propagate
        return true
      })

      getAccountMock.mockResolvedValue(buildAccount())

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy({
          id: 'mutate-attempt',
          name: 'mutate-attempt',
          scope: 'project',
          rules: [{ name: 'r', operation: 'sendTransaction', action: 'ALLOW', conditions: [condition] }]
        })

      const account = await wdk.getAccount('ethereum', 0)

      const tx = { to: RECIPIENT, value: 1n }
      await account.sendTransaction(tx)

      expect(sendTransactionMock).toHaveBeenCalledWith({ to: RECIPIENT, value: 1n })
      expect(tx.to).toBe(RECIPIENT) // caller's object also unchanged
    })

    test('a non-cloneable governed argument fails closed instead of forwarding a shared reference', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy(projectAllowAll('p'))

      const account = await wdk.getAccount('ethereum', 0)

      const tx = { to: RECIPIENT, value: 1n, onSettled: () => {} }
      const err = await catchAsync(() => account.sendTransaction(tx))

      expect(err.name).toBe('PolicyConfigurationError')
      expect(err.message).toBe(
        "policy engine cannot snapshot argument 0 of governed operation 'sendTransaction': value is not " +
        'structured-cloneable. Governed operations require cloneable arguments so the engine can evaluate ' +
        'and forward the exact values it approved (preventing time-of-check / time-of-use mutation). ' +
        'Pass a plain, cloneable argument instead.'
      )
      expect(sendTransactionMock).not.toHaveBeenCalled()
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

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy(policy)

      // Mutate the original after registration; engine should not see this.
      policy.rules[0].action = 'ALLOW'
      policy.rules[0].conditions = []

      const account = await wdk.getAccount('ethereum', 0)
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

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy(projectDenyAll('p'))

      const err = await catchAsync(() => wdk.getAccount('ethereum', 0))

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

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerProtocol('ethereum', 'velora', MySwapProtocol, {})
        .registerPolicy({
          id: 'no-swaps',
          name: 'no-swaps',
          scope: 'project',
          rules: [{ name: 'deny-swap', operation: 'swap', action: 'DENY', conditions: [] }]
        })

      const account = await wdk.getAccount('ethereum', 0)
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

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerProtocol('ethereum', 'velora', MySwapProtocol, {})
        .registerPolicy({
          id: 'no-swaps',
          name: 'no-swaps',
          scope: 'project',
          rules: [{ name: 'deny-swap', operation: 'swap', action: 'DENY', conditions: [] }]
        })

      const account = await wdk.getAccount('ethereum', 0)
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

      wdk
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

      const account = await wdk.getAccount('ethereum', 0)
      const bridge = account.getBridgeProtocol('oft')

      const result = await bridge.bridge()

      expect(result.hash).toBe(DUMMY_TX_HASH)
      expect(condition).toHaveBeenCalledTimes(1)
      expect(condition).toHaveBeenCalledWith(expect.objectContaining({
        operation: 'bridge',
        wallet: 'ethereum'
      }))
      expect(sendTransactionMock).toHaveBeenCalledTimes(1)
      expect(sendTransactionMock).toHaveBeenCalledWith({ to: RECIPIENT, value: 1n })
    })

    test('a swidge protocol write method is wrapped and blocks on DENY', async () => {
      const swidgeInstanceMock = jest.fn().mockResolvedValue(DUMMY_SWIDGE_RESULT)

      class MySwidgeProtocol extends SwidgeProtocol {
        constructor () { super() }
        async swidge (opts) { return swidgeInstanceMock(opts) }
      }

      getAccountMock.mockResolvedValue(buildAccount())

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerProtocol('ethereum', 'bridge-and-swap', MySwidgeProtocol, {})
        .registerPolicy({
          id: 'no-swidge',
          name: 'no-swidge',
          scope: 'project',
          rules: [{ name: 'deny-swidge', operation: 'swidge', action: 'DENY', conditions: [] }]
        })

      const account = await wdk.getAccount('ethereum', 0)
      const swidge = account.getSwidgeProtocol('bridge-and-swap')

      const denied = await catchAsync(() => swidge.swidge({ fromToken: 'A', toToken: 'B', fromTokenAmount: 1n }))

      expect(denied.name).toBe('PolicyViolationError')
      expect(denied.policyId).toBe('no-swidge')
      expect(denied.ruleName).toBe('deny-swidge')
      expect(swidgeInstanceMock).not.toHaveBeenCalled()
    })

    test('an sda protocol write method (createDepositAddress) is wrapped and blocks on DENY; getSupportedRoutes is not wrapped', async () => {
      const createDepositAddressInstanceMock = jest.fn().mockResolvedValue(DUMMY_SDA_ADDRESS_RESULT)
      const getSupportedRoutesInstanceMock = jest.fn().mockResolvedValue(DUMMY_SDA_ROUTES)

      class MySdaProtocol extends SdaProtocol {
        constructor () { super() }
        async createDepositAddress (opts) { return createDepositAddressInstanceMock(opts) }
        async getSupportedRoutes (opts) { return getSupportedRoutesInstanceMock(opts) }
      }

      getAccountMock.mockResolvedValue(buildAccount())

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerProtocol('ethereum', 'accumulate', MySdaProtocol, {})
        .registerPolicy({
          id: 'no-sda',
          name: 'no-sda',
          scope: 'project',
          rules: [{ name: 'deny-create-deposit', operation: 'createDepositAddress', action: 'DENY', conditions: [] }]
        })

      const account = await wdk.getAccount('ethereum', 0)
      const sda = account.getSdaProtocol('accumulate')

      const denied = await catchAsync(() => sda.createDepositAddress({ sourceChains: ['arbitrum'], destinationChain: 'polygon' }))

      expect(denied.name).toBe('PolicyViolationError')
      expect(denied.policyId).toBe('no-sda')
      expect(denied.ruleName).toBe('deny-create-deposit')
      expect(createDepositAddressInstanceMock).not.toHaveBeenCalled()

      const routes = await sda.getSupportedRoutes({})
      expect(routes).toEqual(DUMMY_SDA_ROUTES)
      expect(getSupportedRoutesInstanceMock).toHaveBeenCalledWith({})
    })

    test('account.simulate.getSdaProtocol(label).createDepositAddress(...) returns a structured DENY without executing', async () => {
      const createDepositAddressInstanceMock = jest.fn().mockResolvedValue(DUMMY_SDA_ADDRESS_RESULT)

      class MySdaProtocol extends SdaProtocol {
        constructor () { super() }
        async createDepositAddress (opts) { return createDepositAddressInstanceMock(opts) }
      }

      getAccountMock.mockResolvedValue(buildAccount())

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerProtocol('ethereum', 'accumulate', MySdaProtocol, {})
        .registerPolicy({
          id: 'no-sda',
          name: 'no-sda',
          scope: 'project',
          rules: [{ name: 'deny-create-deposit', operation: 'createDepositAddress', action: 'DENY', conditions: [] }]
        })

      const account = await wdk.getAccount('ethereum', 0)
      const sim = await account.simulate.getSdaProtocol('accumulate').createDepositAddress({ sourceChains: ['arbitrum'], destinationChain: 'polygon' })

      expect(sim.decision).toBe('DENY')
      expect(sim.policy_id).toBe('no-sda')
      expect(sim.matched_rule).toBe('deny-create-deposit')
      expect(sim.reason).toBe('deny-create-deposit')
      expect(createDepositAddressInstanceMock).not.toHaveBeenCalled()
    })

    test('account.registerProtocol(...) returns the proxy so chained calls stay enforced (C-2)', async () => {
      // Regression for C-2: without intercepting registerProtocol in the
      // proxy's get trap, the underlying _registerProtocols closure hands
      // back the RAW account, and every subsequent write on that reference
      // skips policy evaluation.
      const swapInstanceMock = jest.fn().mockResolvedValue(DUMMY_SWAP_RESULT)

      class MySwapProtocol extends SwapProtocol {
        constructor () { super() }
        async swap (opts) { return swapInstanceMock(opts) }
      }

      getAccountMock.mockResolvedValue(buildAccount())

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy({
          id: 'deny-send',
          name: 'deny-send',
          scope: 'project',
          rules: [{ name: 'deny', operation: 'sendTransaction', action: 'DENY', conditions: [] }]
        })

      const account = await wdk.getAccount('ethereum', 0)
      const returned = account.registerProtocol('velora', MySwapProtocol, {})

      // The returned reference MUST still go through enforcement.
      const err = await catchAsync(() => returned.sendTransaction({ to: RECIPIENT, value: 1n }))

      expect(err.name).toBe('PolicyViolationError')
      expect(err.policyId).toBe('deny-send')
    })
  })

  // -------------------------------------------------------------------------
  // Context object
  // -------------------------------------------------------------------------

  describe('context object', () => {
    test('the condition function receives operation, wallet, params, args, and a read-only account', async () => {
      let captured

      getAccountMock.mockResolvedValue(buildAccount())

      wdk
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

      const account = await wdk.getAccount('base', 0)
      await account.sendTransaction({ to: RECIPIENT, value: 7n }, { gas: 21000 })

      expect(captured.operation).toBe('sendTransaction')
      expect(captured.wallet).toBe('base')
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

  // -------------------------------------------------------------------------
  // Condition timeouts
  // -------------------------------------------------------------------------

  describe('condition timeouts', () => {
    test('a never-resolving condition on an ALLOW rule is timed out and treated as no-match', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy({
          id: 'p',
          name: 'p',
          scope: 'project',
          rules: [{
            name: 'never-resolves',
            operation: 'sendTransaction',
            action: 'ALLOW',
            conditions: [() => new Promise(() => {})]
          }]
        }, { conditionTimeoutMs: 25 })

      const account = await wdk.getAccount('ethereum', 0)
      const err = await catchAsync(() => account.sendTransaction({ to: RECIPIENT, value: 1n }))

      expect(err.name).toBe('PolicyViolationError')
      expect(err.policyId).toBe('<unknown>')
      expect(err.ruleName).toBe('<unknown>')
      expect(err.reason).toBe('governed-but-unmatched')
      expect(sendTransactionMock).not.toHaveBeenCalled()
    })

    test('a never-resolving condition on a DENY rule is timed out and fail-closes (matches and blocks)', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy({
          id: 'sanctions',
          name: 'sanctions',
          scope: 'project',
          rules: [
            {
              name: 'block-on-kyt',
              operation: 'sendTransaction',
              action: 'DENY',
              conditions: [() => new Promise(() => {})]
            },
            {
              name: 'allow-general',
              operation: 'sendTransaction',
              action: 'ALLOW',
              conditions: [() => true]
            }
          ]
        }, { conditionTimeoutMs: 25 })

      const account = await wdk.getAccount('ethereum', 0)
      const err = await catchAsync(() => account.sendTransaction({ to: RECIPIENT, value: 1n }))

      expect(err.name).toBe('PolicyViolationError')
      expect(err.policyId).toBe('sanctions')
      expect(err.ruleName).toBe('block-on-kyt')
      expect(err.reason).toBe('block-on-kyt (condition error: condition timed out after 25ms)')
      expect(sendTransactionMock).not.toHaveBeenCalled()
    })

    test('rejects non-positive conditionTimeoutMs at registration time', () => {
      const cases = [
        { value: -1, message: "registerPolicy options: 'conditionTimeoutMs': Too small: expected number to be >0" },
        { value: 0, message: "registerPolicy options: 'conditionTimeoutMs': Too small: expected number to be >0" },
        { value: NaN, message: "registerPolicy options: 'conditionTimeoutMs': Invalid input: expected number, received NaN" },
        { value: Infinity, message: "registerPolicy options: 'conditionTimeoutMs': Invalid input: expected number, received number" },
        { value: '30000', message: "registerPolicy options: 'conditionTimeoutMs': Invalid input: expected number, received string" },
        { value: null, message: "registerPolicy options: 'conditionTimeoutMs': Invalid input: expected number, received null" }
      ]

      for (const { value, message } of cases) {
        const err = catchSync(() =>
          wdk.registerPolicy(projectAllowAll('p'), { conditionTimeoutMs: value })
        )

        expect(err.name).toBe('PolicyConfigurationError')
        expect(err.message).toBe(message)
      }
    })

    test('a condition that resolves before the timeout is unaffected', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      let invoked = 0

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy({
          id: 'p',
          name: 'p',
          scope: 'project',
          rules: [{
            name: 'r',
            operation: 'sendTransaction',
            action: 'ALLOW',
            conditions: [async () => { invoked++; return true }]
          }]
        }, { conditionTimeoutMs: 5_000 })

      const account = await wdk.getAccount('ethereum', 0)
      const result = await account.sendTransaction({ to: RECIPIENT, value: 1n })

      expect(result.hash).toBe(DUMMY_TX_HASH)
      expect(invoked).toBe(1)
      expect(sendTransactionMock).toHaveBeenCalledWith({ to: RECIPIENT, value: 1n })
    })
  })

  // -------------------------------------------------------------------------
  // Fail-closed DENY (throwing condition)
  // -------------------------------------------------------------------------

  describe('throwing DENY conditions', () => {
    test('a throwing DENY condition matches (fail-closed) and blocks even when a sibling ALLOW would match', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy({
          id: 'sanctions',
          name: 'sanctions',
          scope: 'project',
          rules: [
            {
              name: 'block-sanctioned',
              operation: 'sendTransaction',
              action: 'DENY',
              conditions: [() => { throw new Error('KYT service down') }]
            },
            {
              name: 'allow-general',
              operation: 'sendTransaction',
              action: 'ALLOW',
              conditions: [() => true]
            }
          ]
        })

      const account = await wdk.getAccount('ethereum', 0)
      const err = await catchAsync(() => account.sendTransaction({ to: SANCTIONED, value: 1n }))

      expect(err.name).toBe('PolicyViolationError')
      expect(err.policyId).toBe('sanctions')
      expect(err.ruleName).toBe('block-sanctioned')
      expect(err.reason).toBe('block-sanctioned (condition error: KYT service down)')
      expect(sendTransactionMock).not.toHaveBeenCalled()
    })

    test('a throwing ALLOW condition is treated as no-match and falls through to other rules', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy({
          id: 'p',
          name: 'p',
          scope: 'project',
          rules: [
            {
              name: 'allow-throw',
              operation: 'sendTransaction',
              action: 'ALLOW',
              conditions: [() => { throw new Error('boom') }]
            },
            {
              name: 'allow-fallback',
              operation: 'sendTransaction',
              action: 'ALLOW',
              conditions: [() => true]
            }
          ]
        })

      const account = await wdk.getAccount('ethereum', 0)
      const result = await account.sendTransaction({ to: RECIPIENT, value: 1n })

      expect(result.hash).toBe(DUMMY_TX_HASH)
      expect(sendTransactionMock).toHaveBeenCalledWith({ to: RECIPIENT, value: 1n })
    })

    test('rule.reason on a DENY with a throwing condition takes precedence over the auto-generated condition-error reason', async () => {
      getAccountMock.mockResolvedValue(buildAccount())

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy({
          id: 'sanctions',
          name: 'sanctions',
          scope: 'project',
          rules: [{
            name: 'block-sanctioned',
            reason: 'KYT screening required',
            operation: 'sendTransaction',
            action: 'DENY',
            conditions: [() => { throw new Error('KYT service down') }]
          }]
        })

      const account = await wdk.getAccount('ethereum', 0)
      const err = await catchAsync(() => account.sendTransaction({ to: SANCTIONED, value: 1n }))

      expect(err.reason).toBe('KYT screening required')
    })
  })

  // -------------------------------------------------------------------------
  // Project-scope chain narrowing
  // -------------------------------------------------------------------------

  describe('wallet-bound project policies', () => {
    test('a project policy registered with a wallet only applies to that wallet', async () => {
      getAccountMock.mockImplementation(async () => buildAccount())

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerWallet('ton', WalletManagerMock, {})
        .registerPolicy({
          id: 'eth-only',
          name: 'eth-only',
          scope: 'project',
          wallet: 'ethereum',
          rules: [{ name: 'deny', operation: 'sendTransaction', action: 'DENY', conditions: [] }]
        })

      const eth = await wdk.getAccount('ethereum', 0)
      const ton = await wdk.getAccount('ton', 0)

      const ethErr = await catchAsync(() => eth.sendTransaction({ to: RECIPIENT, value: 1n }))
      const tonResult = await ton.sendTransaction({ to: RECIPIENT, value: 1n })

      expect(ethErr.name).toBe('PolicyViolationError')
      expect(ethErr.policyId).toBe('eth-only')
      expect(tonResult.hash).toBe(DUMMY_TX_HASH)
    })

    test('a project policy with no wallet binding applies to every wallet', async () => {
      getAccountMock.mockImplementation(async () => buildAccount())

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerWallet('ton', WalletManagerMock, {})
        .registerPolicy(projectDenyAll('global'))

      const eth = await wdk.getAccount('ethereum', 0)
      const ton = await wdk.getAccount('ton', 0)

      const ethErr = await catchAsync(() => eth.sendTransaction({ to: RECIPIENT, value: 1n }))
      const tonErr = await catchAsync(() => ton.sendTransaction({ to: RECIPIENT, value: 1n }))

      expect(ethErr.policyId).toBe('global')
      expect(tonErr.policyId).toBe('global')
    })
  })

  // -------------------------------------------------------------------------
  // Account-scope: accounts field accepts both derivation paths and indexes
  // -------------------------------------------------------------------------

  describe('account identifiers', () => {
    test('accounts as integer indexes match the index passed to wdk.getAccount(wallet, index)', async () => {
      getAccountMock.mockImplementation(async (idx) => buildAccount(`0'/0/${idx}`))

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy({
          id: 'cold-storage',
          name: 'cold-storage',
          scope: 'account',
          wallet: 'ethereum',
          accounts: [0],
          rules: [{ name: 'deny', operation: 'sendTransaction', action: 'DENY', conditions: [] }]
        })

      const account0 = await wdk.getAccount('ethereum', 0)
      const account1 = await wdk.getAccount('ethereum', 1)

      const err = await catchAsync(() => account0.sendTransaction({ to: RECIPIENT, value: 1n }))
      const result = await account1.sendTransaction({ to: RECIPIENT, value: 1n })

      expect(err.policyId).toBe('cold-storage')
      expect(result.hash).toBe(DUMMY_TX_HASH)
    })

    test('accounts can mix derivation paths and integer indexes in the same array', async () => {
      getAccountMock.mockImplementation(async (idx) => buildAccount(`0'/0/${idx}`))

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy({
          id: 'mixed',
          name: 'mixed',
          scope: 'account',
          wallet: 'ethereum',
          accounts: [0, "0'/0/2"],
          rules: [{ name: 'deny', operation: 'sendTransaction', action: 'DENY', conditions: [] }]
        })

      const account0 = await wdk.getAccount('ethereum', 0)
      const account1 = await wdk.getAccount('ethereum', 1)
      const account2 = await wdk.getAccount('ethereum', 2)

      const err0 = await catchAsync(() => account0.sendTransaction({ to: RECIPIENT, value: 1n }))
      const result1 = await account1.sendTransaction({ to: RECIPIENT, value: 1n })
      const err2 = await catchAsync(() => account2.sendTransaction({ to: RECIPIENT, value: 1n }))

      expect(err0.policyId).toBe('mixed')
      expect(result1.hash).toBe(DUMMY_TX_HASH)
      expect(err2.policyId).toBe('mixed')
    })

    test('an index entry does not match accounts retrieved via getAccountByPath (path-only retrieval)', async () => {
      getAccountByPathMock.mockResolvedValue(buildAccount("0'/0/0"))

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy({
          id: 'index-only',
          name: 'index-only',
          scope: 'account',
          wallet: 'ethereum',
          accounts: [0],
          rules: [{ name: 'deny', operation: 'sendTransaction', action: 'DENY', conditions: [] }]
        })

      const account = await wdk.getAccountByPath('ethereum', "0'/0/0")
      const result = await account.sendTransaction({ to: RECIPIENT, value: 1n })

      expect(result.hash).toBe(DUMMY_TX_HASH)
    })

    test('a path entry matches accounts retrieved via either getAccount(wallet, index) or getAccountByPath(wallet, path)', async () => {
      getAccountMock.mockImplementation(async (idx) => buildAccount(`0'/0/${idx}`))
      getAccountByPathMock.mockResolvedValue(buildAccount("0'/0/5"))

      wdk
        .registerWallet('ethereum', WalletManagerMock, {})
        .registerPolicy({
          id: 'path-bound',
          name: 'path-bound',
          scope: 'account',
          wallet: 'ethereum',
          accounts: ["0'/0/5"],
          rules: [{ name: 'deny', operation: 'sendTransaction', action: 'DENY', conditions: [] }]
        })

      const viaIndex = await wdk.getAccount('ethereum', 5)
      const viaPath = await wdk.getAccountByPath('ethereum', "0'/0/5")

      const err1 = await catchAsync(() => viaIndex.sendTransaction({ to: RECIPIENT, value: 1n }))
      const err2 = await catchAsync(() => viaPath.sendTransaction({ to: RECIPIENT, value: 1n }))

      expect(err1.policyId).toBe('path-bound')
      expect(err2.policyId).toBe('path-bound')
    })

    test('rejects accounts entries that are neither non-empty strings nor non-negative integers', () => {
      wdk.registerWallet('ethereum', WalletManagerMock, {})

      const cases = [
        { value: -1, message: "Policy 'p': 'accounts.0': Too small: expected number to be >=0" },
        { value: 1.5, message: "Policy 'p': 'accounts.0': Invalid input" },
        { value: NaN, message: "Policy 'p': 'accounts.0': Invalid input" },
        { value: '', message: "Policy 'p': 'accounts.0': Too small: expected string to have >=1 characters" },
        { value: null, message: "Policy 'p': 'accounts.0': Invalid input" },
        { value: undefined, message: "Policy 'p': 'accounts.0': Invalid input" },
        { value: true, message: "Policy 'p': 'accounts.0': Invalid input" },
        { value: {}, message: "Policy 'p': 'accounts.0': Invalid input" }
      ]

      for (const { value, message } of cases) {
        const policy = { id: 'p', name: 'p', scope: 'account', wallet: 'ethereum', accounts: [value], rules: [{ name: 'r', operation: 'sendTransaction', action: 'ALLOW', conditions: [] }] }
        const err = catchSync(() => wdk.registerPolicy(policy))

        expect(err.name).toBe('PolicyConfigurationError')
        expect(err.message).toBe(message)
      }
    })
  })
})
