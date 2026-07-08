// Copyright 2024 Tether Operations Limited
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict'

import { OPERATIONS, PROTOCOL_METHODS } from './constants.js'
import { buildContext, snapshotArgs } from './policy-context.js'
import PolicyViolationError, { PolicyConfigurationError } from './policy-error.js'

/** @typedef {import('@tetherto/wdk-wallet').IWalletAccount} IWalletAccount */
/** @typedef {import('./policy-engine.js').default} PolicyEngine */
/** @typedef {import('./policy-engine.js').WrapContext} WrapContext */

const PROTOCOL_GETTERS = [
  ['getSwapProtocol', 'swap'],
  ['getBridgeProtocol', 'bridge'],
  ['getLendingProtocol', 'lending'],
  ['getFiatProtocol', 'fiat'],
  ['getSwidgeProtocol', 'swidge'],
  ['getSdaProtocol', 'sda']
]

function isProtectedMember (prop) {
  return prop === 'keyPair' || (typeof prop === 'string' && prop.startsWith('_'))
}

/**
 * Returns a Proxy that exposes policy-enforced versions of write methods on
 * the given account. The policy engine itself does not mutate the account
 * (the WDK's `_registerProtocols` step does install
 * `registerProtocol` / `getXProtocol` helpers on the account before the
 * proxy is built — that's a separate, pre-existing concern).
 *
 * Nested-call escape falls out naturally from how the Proxy works rather
 * than from any kind of async-context tracking:
 *
 * - When a user calls a write method via the proxy, the proxy's `get` trap
 *   returns the enforced wrapper. The wrapper evaluates policies, then
 *   invokes the original method (bound to the underlying account, not the
 *   proxy).
 * - Inside the original method, `this.someOtherMethod()` resolves on the
 *   underlying account — bypassing the proxy entirely. SDK code that holds
 *   a direct reference to the underlying account (which is how protocol
 *   packages are constructed) is also unaffected.
 * - Only access through the proxy goes through policy evaluation.
 *
 * This works identically on every JavaScript runtime that supports `Proxy`
 * (i.e. all of them). No async context, no Promise patching, no
 * runtime-specific code paths.
 *
 * If no policy applies to the (wallet, path, index) tuple, the function
 * returns the original account unchanged.
 *
 * @internal
 * @param {IWalletAccount} account - The underlying account from the wallet manager.
 * @param {WrapContext} options - The per-account routing context (wallet identifier, path/index, and the engine reference).
 * @returns {Promise<IWalletAccount>} The proxy-wrapped account, or the original if no policy applies.
 * @throws {PolicyConfigurationError} If at least one policy applies but the underlying account does not implement `toReadOnlyAccount()`.
 */
export async function createPolicyEnforcedAccount (account, { blockchain, path, index, engine }) {
  if (!engine._isGoverned(blockchain, path, index)) return account

  if (typeof account.toReadOnlyAccount !== 'function') {
    throw new PolicyConfigurationError(
      `policy engine requires IWalletAccount.toReadOnlyAccount() but the wallet for blockchain '${blockchain}' does not provide it.`
    )
  }

  const readOnlyAccount = await account.toReadOnlyAccount()

  const ctx = { account, readOnlyAccount, blockchain, index, engine }

  const enforcedMethods = new Map()

  // Wrap every method in OPERATIONS that exists on the underlying account,
  // not just the ones referenced by registered policies. The evaluator
  // default-denies any operation no rule addresses — without wrapping the
  // full set we'd leave sibling methods un-intercepted (e.g. a 'cap transfer'
  // policy would not prevent `sendTransaction({ to: token, data: ... })`
  // from moving the same tokens).
  for (const op of OPERATIONS) {
    if (typeof account[op] === 'function') {
      enforcedMethods.set(op, buildEnforcedMethod(op, account[op].bind(account), ctx))
    }
  }

  const enforcedGetters = new Map()

  for (const [getterName, type] of PROTOCOL_GETTERS) {
    if (typeof account[getterName] !== 'function') continue

    const writeMethods = PROTOCOL_METHODS[type]
    const originalGetter = account[getterName].bind(account)

    enforcedGetters.set(getterName, (label) => {
      const protocol = originalGetter(label)

      return wrapProtocolInProxy(protocol, writeMethods, ctx)
    })
  }

  const simulate = buildSimulateMirror(Array.from(enforcedMethods.keys()), ctx)

  // Late-bound reference to the proxy itself, so the `registerProtocol`
  // interceptor below can return the proxy instead of the raw account.
  const handle = { proxy: null }

  const proxyHandle = new Proxy(account, {
    get (target, prop) {
      if (enforcedMethods.has(prop)) return enforcedMethods.get(prop)
      if (enforcedGetters.has(prop)) return enforcedGetters.get(prop)
      if (prop === 'simulate') return simulate

      // `account.registerProtocol(...)` returns the raw account by design
      // (see `_registerProtocols` in wdk.js). Without intercepting
      // here, `proxy.registerProtocol(...).sendTransaction(...)` would skip
      // enforcement entirely because the caller is no longer holding the
      // proxy. Rewrite the return value to the proxy itself.
      if (prop === 'registerProtocol' && typeof target.registerProtocol === 'function') {
        const fn = target.registerProtocol.bind(target)

        return (...args) => {
          fn(...args)

          return handle.proxy
        }
      }

      if (isProtectedMember(prop)) return undefined

      const value = Reflect.get(target, prop, target)

      // Bind functions to the underlying target so internal `this.method()`
      // calls resolve on the original account, bypassing the proxy. This is
      // how nested-call escape works without any async-context tracking.
      if (typeof value === 'function') return value.bind(target)

      return value
    }
  })

  handle.proxy = proxyHandle

  return proxyHandle
}

function buildEnforcedMethod (name, boundOriginal, ctx) {
  return async function policyEnforced (...args) {
    const forwardedArgs = snapshotArgs(args, name)

    const context = buildContext({
      operation: name,
      wallet: ctx.blockchain,
      account: ctx.readOnlyAccount,
      args: forwardedArgs
    })

    const verdict = await ctx.engine._evaluateContext(context, { path: ctx.account.path, index: ctx.index })

    if (verdict.outcome === 'BLOCK') {
      throw new PolicyViolationError({
        policyId: verdict.policyId ?? '<unknown>',
        ruleName: verdict.ruleName ?? '<unknown>',
        reason: verdict.reason ?? 'unknown'
      })
    }

    return boundOriginal(...forwardedArgs)
  }
}

function wrapProtocolInProxy (protocol, opsToWrap, ctx) {
  const enforcedMethods = new Map()

  for (const method of opsToWrap) {
    if (typeof protocol[method] === 'function') {
      enforcedMethods.set(method, buildEnforcedMethod(method, protocol[method].bind(protocol), ctx))
    }
  }

  return new Proxy(protocol, {
    get (target, prop) {
      if (enforcedMethods.has(prop)) return enforcedMethods.get(prop)

      if (isProtectedMember(prop)) return undefined

      const value = Reflect.get(target, prop, target)

      if (typeof value === 'function') return value.bind(target)

      return value
    }
  })
}

function buildSimulateMirror (methodNames, ctx) {
  const simulate = Object.create(null)

  for (const name of methodNames) {
    simulate[name] = async (...args) => {
      const context = buildContext({
        operation: name,
        wallet: ctx.blockchain,
        account: ctx.readOnlyAccount,
        args
      })

      return ctx.engine._simulateContext(context, { path: ctx.account.path, index: ctx.index })
    }
  }

  for (const [getterName, type] of PROTOCOL_GETTERS) {
    if (typeof ctx.account[getterName] !== 'function') continue

    const writeMethods = PROTOCOL_METHODS[type]

    // Accept the `label` arg for parity with the real `account.getXProtocol(label)`.
    // Simulation is label-agnostic; the arg is reserved for future use if
    // simulate ever needs to differentiate by protocol label.
    simulate[getterName] = (_label) => {
      const out = Object.create(null)

      for (const method of writeMethods) {
        out[method] = async (...args) => {
          const context = buildContext({
            operation: method,
            wallet: ctx.blockchain,
            account: ctx.readOnlyAccount,
            args
          })

          return ctx.engine._simulateContext(context, { path: ctx.account.path, index: ctx.index })
        }
      }

      return out
    }
  }

  return simulate
}
