'use strict'

import { describe, expect, test } from '@jest/globals'

import { PolicyConfigurationError, RulePolicy } from '../index.js'

import { buildContext } from '../src/policy/policy-context.js'
import { evaluate } from '../src/policy/policy-evaluator.js'
import PolicyRegistry from '../src/policy/policy-registry.js'
import { validatePolicy } from '../src/policy/policy-validators.js'

const WALLET = 'mainnet'
const OTHER_WALLET = 'treasury'
const PATH_DEFAULT = "0'/0/0"
const PATH_SECONDARY = "0'/0/1"
const RECIPIENT = '0x1111111111111111111111111111111111111111'
const SANCTIONED = '0x2222222222222222222222222222222222222222'
const TOKEN = '0x4444444444444444444444444444444444444444'

const DUMMY_ADDRESS = '0xdummy-address'

const readOnlyAccount = { getAddress: async () => DUMMY_ADDRESS }

const record = ({ method = 'transfer', args = [{ token: TOKEN, recipient: RECIPIENT, amount: 40n }], walletType = WALLET, path = PATH_DEFAULT, index = 0 } = {}) => ({
  kind: 'spend',
  asset: TOKEN,
  amount: 40n,
  destination: RECIPIENT,
  raw: { walletType, method, args, account: readOnlyAccount, path, index }
})

const definition = (overrides = {}) => ({
  id: 'p1',
  name: 'policy one',
  scope: 'project',
  rules: [{ name: 'allow-transfer', operation: 'transfer', action: 'ALLOW', conditions: [] }],
  ...overrides
})

const withRules = (rules, overrides = {}) => definition({ rules, ...overrides })

const denyRecipient = (blocked, extra = {}) => ({
  name: 'deny-recipient',
  operation: 'transfer',
  action: 'DENY',
  reason: 'recipient is sanctioned',
  conditions: [(ctx) => ctx.args[0].recipient === blocked],
  ...extra
})

describe('RulePolicy construction', () => {
  test('exposes id, name and scope from the definition', () => {
    const policy = new RulePolicy(definition({ scope: 'account', wallet: WALLET, accounts: [PATH_DEFAULT] }))

    expect(policy.id).toBe('p1')
    expect(policy.name).toBe('policy one')
    expect(policy.scope).toBe('account')
  })

  test('rejects a definition that fails registerPolicy validation', () => {
    expect(() => new RulePolicy(definition({ scope: 'account' }))).toThrow(PolicyConfigurationError)
    expect(() => new RulePolicy(definition({ rules: [] }))).toThrow(PolicyConfigurationError)
  })

  test('rejects options that fail registerPolicy validation', () => {
    expect(() => new RulePolicy(definition(), { conditionTimeoutMs: -1 })).toThrow(PolicyConfigurationError)
  })
})

describe('RulePolicy.match', () => {
  test('matches when a rule names the method', async () => {
    await expect(new RulePolicy(definition()).match(record())).resolves.toBe(true)
  })

  test('matches via the wildcard and via an operation array', async () => {
    await expect(new RulePolicy(withRules([{ name: 'any', operation: '*', action: 'ALLOW', conditions: [] }])).match(record({ method: 'approve' }))).resolves.toBe(true)
    await expect(new RulePolicy(withRules([{ name: 'some', operation: ['approve', 'transfer'], action: 'ALLOW', conditions: [] }])).match(record({ method: 'approve' }))).resolves.toBe(true)
  })

  test('does not match a method no rule addresses', async () => {
    await expect(new RulePolicy(definition()).match(record({ method: 'approve' }))).resolves.toBe(false)
  })

  test('honours a project policy wallet restriction', async () => {
    const policy = new RulePolicy(definition({ wallet: WALLET }))

    await expect(policy.match(record())).resolves.toBe(true)
    await expect(policy.match(record({ walletType: OTHER_WALLET }))).resolves.toBe(false)
  })

  test('an unbound project policy matches on every wallet', async () => {
    const policy = new RulePolicy(definition())

    await expect(policy.match(record({ walletType: OTHER_WALLET }))).resolves.toBe(true)
  })

  test('honours account-scope path and index bindings', async () => {
    const byPath = new RulePolicy(definition({ scope: 'account', wallet: WALLET, accounts: [PATH_SECONDARY] }))
    const byIndex = new RulePolicy(definition({ scope: 'account', wallet: WALLET, accounts: [1] }))

    await expect(byPath.match(record({ path: PATH_SECONDARY, index: 1 }))).resolves.toBe(true)
    await expect(byPath.match(record({ path: PATH_DEFAULT, index: 0 }))).resolves.toBe(false)
    await expect(byIndex.match(record({ path: PATH_SECONDARY, index: 1 }))).resolves.toBe(true)
    await expect(byIndex.match(record({ path: PATH_SECONDARY, index: undefined }))).resolves.toBe(false)
  })
})

describe('RulePolicy.evaluate', () => {
  test('an ALLOW rule with no conditions allows', async () => {
    await expect(new RulePolicy(definition()).evaluate(record())).resolves.toEqual({ outcome: 'allow' })
  })

  test('a matching DENY rule denies with the rule reason', async () => {
    const policy = new RulePolicy(withRules([denyRecipient(SANCTIONED)]))

    await expect(policy.evaluate(record({ args: [{ token: TOKEN, recipient: SANCTIONED, amount: 1n }] }))).resolves.toEqual({ outcome: 'deny', reason: 'recipient is sanctioned' })
  })

  test('a DENY rule without a reason denies with the rule name', async () => {
    const policy = new RulePolicy(withRules([{ name: 'deny-all-transfers', operation: 'transfer', action: 'DENY', conditions: [] }]))

    await expect(policy.evaluate(record())).resolves.toEqual({ outcome: 'deny', reason: 'deny-all-transfers' })
  })

  test('rules whose conditions do not hold produce an abstain, not a deny', async () => {
    const policy = new RulePolicy(withRules([denyRecipient(SANCTIONED)]))
    const verdict = await policy.evaluate(record())

    expect(verdict.outcome).toBe('abstain')
    expect(verdict.reason).toMatch(/no rule matched transfer/)
  })

  test('DENY wins over ALLOW within the same policy', async () => {
    const policy = new RulePolicy(withRules([
      { name: 'allow-all', operation: 'transfer', action: 'ALLOW', conditions: [] },
      denyRecipient(SANCTIONED)
    ]))

    await expect(policy.evaluate(record({ args: [{ token: TOKEN, recipient: SANCTIONED, amount: 1n }] }))).resolves.toMatchObject({ outcome: 'deny' })
    await expect(policy.evaluate(record())).resolves.toEqual({ outcome: 'allow' })
  })

  test('a throwing condition fails closed on a DENY rule and open-as-no-match on an ALLOW rule', async () => {
    const boom = () => { throw new Error('kyt unavailable') }

    const deny = new RulePolicy(withRules([{ name: 'deny-kyt', operation: 'transfer', action: 'DENY', conditions: [boom] }]))
    const allow = new RulePolicy(withRules([{ name: 'allow-kyt', operation: 'transfer', action: 'ALLOW', conditions: [boom] }]))

    await expect(deny.evaluate(record())).resolves.toEqual({ outcome: 'deny', reason: 'deny-kyt (condition error: kyt unavailable)' })
    await expect(allow.evaluate(record())).resolves.toMatchObject({ outcome: 'abstain' })
  })

  test('a condition that exceeds conditionTimeoutMs is treated like a throw', async () => {
    const slow = () => new Promise((resolve) => setTimeout(() => resolve(true), 50))

    const deny = new RulePolicy(withRules([{ name: 'deny-slow', operation: 'transfer', action: 'DENY', conditions: [slow] }]), { conditionTimeoutMs: 10 })
    const allow = new RulePolicy(withRules([{ name: 'allow-slow', operation: 'transfer', action: 'ALLOW', conditions: [slow] }]), { conditionTimeoutMs: 10 })

    const denied = await deny.evaluate(record())
    expect(denied.outcome).toBe('deny')
    expect(denied.reason).toMatch(/timed out after 10ms/)
    await expect(allow.evaluate(record())).resolves.toMatchObject({ outcome: 'abstain' })
  })

  test('conditions receive the frozen, snapshotted PolicyContext the engine builds', async () => {
    let seen
    const policy = new RulePolicy(withRules([{
      name: 'capture',
      operation: 'transfer',
      action: 'ALLOW',
      conditions: [(ctx) => { seen = ctx; return true }]
    }]))
    const args = [{ token: TOKEN, recipient: RECIPIENT, amount: 40n }]

    await policy.evaluate(record({ args }))

    expect(seen.operation).toBe('transfer')
    expect(seen.wallet).toBe(WALLET)
    expect(seen.account).toBe(readOnlyAccount)
    expect(seen.args[0]).toEqual(args[0])
    expect(seen.args[0]).not.toBe(args[0])
    expect(Object.isFrozen(seen)).toBe(true)
    expect(Object.isFrozen(seen.args)).toBe(true)
  })

  test('an account-scope ALLOW rule with override_broader_scope reports the override reason', async () => {
    const policy = new RulePolicy(definition({
      scope: 'account',
      wallet: WALLET,
      accounts: [PATH_DEFAULT],
      rules: [{ name: 'override', operation: 'transfer', action: 'ALLOW', override_broader_scope: true, conditions: [] }]
    }))

    await expect(policy.evaluate(record())).resolves.toEqual({ outcome: 'allow', reason: 'override' })
  })

  test('commit and rollback are no-ops', async () => {
    const policy = new RulePolicy(definition())

    await expect(policy.commit(record())).resolves.toBeUndefined()
    await expect(policy.rollback(record())).resolves.toBeUndefined()
  })
})

describe('RulePolicy is verdict-equivalent to the engine evaluator', () => {
  const cases = [
    ['ALLOW rule, no conditions', definition(), record()],
    ['DENY rule matched', withRules([denyRecipient(SANCTIONED)]), record({ args: [{ token: TOKEN, recipient: SANCTIONED, amount: 1n }] })],
    ['DENY rule unmatched', withRules([denyRecipient(SANCTIONED)]), record()],
    ['ALLOW after DENY unmatched', withRules([denyRecipient(SANCTIONED), { name: 'allow', operation: 'transfer', action: 'ALLOW', conditions: [] }]), record()],
    ['wildcard ALLOW on another method', withRules([{ name: 'any', operation: '*', action: 'ALLOW', conditions: [] }]), record({ method: 'approve' })],
    ['override on account scope', definition({ scope: 'account', wallet: WALLET, accounts: [0], rules: [{ name: 'o', operation: 'transfer', action: 'ALLOW', override_broader_scope: true, conditions: [] }] }), record()]
  ]

  test.each(cases)('%s', async (_label, def, op) => {
    const registry = new PolicyRegistry()
    registry.add(def, validatePolicy(def), 30_000)
    const context = buildContext({ operation: op.raw.method, wallet: op.raw.walletType, account: op.raw.account, args: op.raw.args })
    const engine = await evaluate(context, registry.applicable(op.raw.walletType, op.raw.path, op.raw.index))

    const mine = await new RulePolicy(def).evaluate(op)

    if (engine.outcome === 'ALLOW') {
      expect(mine.outcome).toBe('allow')
      if (engine.reason === 'override') expect(mine.reason).toBe('override')
    } else if (engine.reason === 'governed-but-unmatched' || engine.reason === 'no-applicable-rule') {
      expect(mine.outcome).toBe('abstain')
    } else {
      expect(mine).toEqual({ outcome: 'deny', reason: engine.reason })
    }
  })
})
