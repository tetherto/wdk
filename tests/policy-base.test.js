'use strict'

import { describe, expect, test } from '@jest/globals'

import { NotImplementedError } from '@tetherto/wdk-wallet'

import { AdapterRegistry, PolicyAdapterError, TransactionPolicy, coerceAmount } from '../index.js'

const WALLET = 'mainnet'
const RECIPIENT = '0x1111111111111111111111111111111111111111'
const TOKEN = '0x4444444444444444444444444444444444444444'

const DUMMY_ADDRESS = '0xdummy-address'

const spendAdapter = (walletTypes = [WALLET]) => ({
  walletTypes,
  extractors: {
    transfer: (args) => ({ kind: 'spend', asset: args[0].token, amount: coerceAmount(args[0].amount), destination: args[0].recipient }),
    payBatch: (args) => args[0].map((item) => ({ kind: 'spend', asset: TOKEN, amount: coerceAmount(item.amount), destination: item.to })),
    unmapped: () => null
  }
})

const transferArgs = [{ token: TOKEN, recipient: RECIPIENT, amount: 40n }]
const call = (walletType, method, args, account, path, index) => ({ walletType, method, args, account, path, index })

describe('coerceAmount', () => {
  test.each([
    ['bigint', 42n, 42n],
    ['zero bigint', 0n, 0n],
    ['safe integer number', 42, 42n],
    ['zero number', 0, 0n],
    ['decimal integer string', '1000000', 1000000n]
  ])('accepts %s', (_label, input, expected) => {
    expect(coerceAmount(input)).toBe(expected)
  })

  test.each([
    ['negative bigint', -1n],
    ['negative number', -1],
    ['non-integer number', 1.5],
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['unsafe integer', 2 ** 53],
    ['null', null],
    ['undefined', undefined],
    ['negative string', '-5'],
    ['decimal string', '1.5'],
    ['hex string', '0x10'],
    ['empty string', ''],
    ['object', { amount: 1n }],
    ['boolean', true]
  ])('returns undefined for %s', (_label, input) => {
    expect(coerceAmount(input)).toBeUndefined()
  })
})

describe('AdapterRegistry.register', () => {
  test('binds one adapter to every wallet identifier it names', () => {
    const registry = new AdapterRegistry().register(spendAdapter(['mainnet', 'arbitrum']))

    for (const wallet of ['mainnet', 'arbitrum']) {
      const [record] = registry.interpret(call(wallet, 'transfer', transferArgs))

      expect(record).toMatchObject({ kind: 'spend', asset: TOKEN, amount: 40n, destination: RECIPIENT })
      expect(record.raw.walletType).toBe(wallet)
    }
  })

  test('a later registration for the same identifier replaces the earlier one', () => {
    const first = { walletTypes: [WALLET], extractors: { transfer: () => ({ kind: 'spend', asset: 'FIRST' }) } }
    const second = { walletTypes: [WALLET], extractors: { transfer: () => ({ kind: 'spend', asset: 'SECOND' }) } }
    const registry = new AdapterRegistry().register(first).register(second)

    expect(registry.interpret(call(WALLET, 'transfer', [])).at(0).asset).toBe('SECOND')
  })

  test.each([
    ['empty walletTypes', { walletTypes: [], extractors: {} }, /cannot be an empty list/],
    ['empty-string key', { walletTypes: [''], extractors: {} }, /blank key/],
    ['whitespace key', { walletTypes: ['   '], extractors: {} }, /blank key/]
  ])('rejects degenerate adapter: %s', (_label, adapter, message) => {
    expect(() => new AdapterRegistry().register(adapter)).toThrow(message)
  })

  test('walletTypes() reports every registered identifier', () => {
    const registry = new AdapterRegistry().register(spendAdapter(['mainnet', 'base']))

    expect(registry.walletTypes().sort()).toEqual(['base', 'mainnet'])
  })
})

describe('AdapterRegistry.extend', () => {
  test('merges new extractors into an existing identifier and keeps the existing ones', () => {
    const registry = new AdapterRegistry()
      .register(spendAdapter())
      .extend(WALLET, { payVendor: () => ({ kind: 'spend', asset: TOKEN, amount: 1n }) })

    expect(registry.interpret(call(WALLET, 'payVendor', [])).at(0).amount).toBe(1n)
    expect(registry.interpret(call(WALLET, 'transfer', transferArgs)).at(0).amount).toBe(40n)
  })

  test('overrides an existing method on that identifier only', () => {
    const registry = new AdapterRegistry()
      .register(spendAdapter(['mainnet', 'arbitrum']))
      .extend('mainnet', { transfer: () => ({ kind: 'spend', asset: 'OVERRIDDEN' }) })

    expect(registry.interpret(call('mainnet', 'transfer', transferArgs)).at(0).asset).toBe('OVERRIDDEN')
    expect(registry.interpret(call('arbitrum', 'transfer', transferArgs)).at(0).asset).toBe(TOKEN)
  })

  test('throws PolicyAdapterError when extending an unregistered identifier', () => {
    expect(() => new AdapterRegistry().extend('nope', { a: () => null })).toThrow(PolicyAdapterError)
  })
})

describe('AdapterRegistry.interpret', () => {
  test('always returns an array, even for single-record extractors', () => {
    const records = new AdapterRegistry().register(spendAdapter()).interpret(call(WALLET, 'transfer', transferArgs))

    expect(Array.isArray(records)).toBe(true)
    expect(records).toHaveLength(1)
  })

  test('returns one record per element when the extractor returns an array', () => {
    const records = new AdapterRegistry().register(spendAdapter()).interpret(call(WALLET, 'payBatch', [[{ to: 'a', amount: 10 }, { to: 'b', amount: 20 }]]))

    expect(records.map((r) => r.amount)).toEqual([10n, 20n])
    expect(records.every((r) => r.raw.method === 'payBatch')).toBe(true)
  })

  test('forwards account, path and index onto raw when supplied, and omits the keys when not', () => {
    const registry = new AdapterRegistry().register(spendAdapter())
    const account = { getAddress: async () => DUMMY_ADDRESS }

    const [withAll] = registry.interpret(call(WALLET, 'transfer', transferArgs, account, "0'/0/3", 3))
    const [withNone] = registry.interpret(call(WALLET, 'transfer', transferArgs))

    expect(withAll.raw.account).toBe(account)
    expect(withAll.raw.path).toBe("0'/0/3")
    expect(withAll.raw.index).toBe(3)
    expect('account' in withNone.raw).toBe(false)
    expect('path' in withNone.raw).toBe(false)
    expect('index' in withNone.raw).toBe(false)
  })

  test('returns null for an unknown wallet, an unknown method, or an extractor that returns null', () => {
    const registry = new AdapterRegistry().register(spendAdapter())

    expect(registry.interpret(call('solana', 'transfer', transferArgs))).toBeNull()
    expect(registry.interpret(call(WALLET, 'somethingUnknown', []))).toBeNull()
    expect(registry.interpret(call(WALLET, 'unmapped', []))).toBeNull()
  })

  test('wraps an extractor that throws in PolicyAdapterError with context and cause', () => {
    const boom = new Error('boom')
    const registry = new AdapterRegistry().register({ walletTypes: [WALLET], extractors: { bad: () => { throw boom } } })

    let caught
    try { registry.interpret(call(WALLET, 'bad', [])) } catch (err) { caught = err }

    expect(caught).toBeInstanceOf(PolicyAdapterError)
    expect(caught.walletType).toBe(WALLET)
    expect(caught.method).toBe('bad')
    expect(caught.cause).toBe(boom)
  })

  test('rejects a record with no kind so a malformed extractor cannot produce an unclassifiable call', () => {
    const registry = new AdapterRegistry().register({ walletTypes: [WALLET], extractors: { noKind: () => ({ amount: 5n }) } })

    expect(() => registry.interpret(call(WALLET, 'noKind', []))).toThrow(PolicyAdapterError)
  })
})

describe('TransactionPolicy base contract', () => {
  const record = { kind: 'spend', asset: TOKEN, amount: 1n, raw: { walletType: WALLET, method: 'transfer', args: transferArgs } }

  test('match resolves true for any record', async () => {
    await expect(new TransactionPolicy().match(record)).resolves.toBe(true)
  })

  test('evaluate rejects with NotImplementedError on the abstract base', async () => {
    await expect(new TransactionPolicy().evaluate(record)).rejects.toBeInstanceOf(NotImplementedError)
  })

  test('commit and rollback resolve as no-ops on the base', async () => {
    const policy = new TransactionPolicy()

    await expect(policy.commit(record)).resolves.toBeUndefined()
    await expect(policy.rollback(record)).resolves.toBeUndefined()
  })

  test('a subclass implementing only evaluate satisfies the contract', async () => {
    class DenyLargeSpends extends TransactionPolicy {
      async evaluate (op) {
        return op.amount > 100n ? { outcome: 'deny', reason: 'too large' } : { outcome: 'allow' }
      }
    }
    const policy = new DenyLargeSpends()

    await expect(policy.match(record)).resolves.toBe(true)
    await expect(policy.evaluate({ ...record, amount: 500n })).resolves.toEqual({ outcome: 'deny', reason: 'too large' })
    await expect(policy.evaluate(record)).resolves.toEqual({ outcome: 'allow' })
  })
})
