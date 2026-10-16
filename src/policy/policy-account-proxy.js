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

import { buildContext, snapshotArgs } from './policy-context.js'
import PolicyViolationError, { PolicyConfigurationError } from './policy-error.js'

/** @typedef {import('@tetherto/wdk-wallet').IWalletAccount} IWalletAccount */
/** @typedef {import('@tetherto/wdk-wallet').IWalletAccountReadOnly} IWalletAccountReadOnly */
/** @typedef {import('./policy-engine.js').default} PolicyEngine */
/** @typedef {import('./policy-engine.js').WrapContext} WrapContext */

/**
 * The per-account state every enforced method closes over.
 *
 * @typedef {Object} EnforcementContext
 * @property {IWalletAccount} account - The raw account the proxy wraps.
 * @property {IWalletAccountReadOnly} readOnlyAccount - The read-only view handed to condition functions as `context.account`.
 * @property {string} blockchain - The wallet identifier (the same string passed to `registerWallet`).
 * @property {string | undefined} path - The derivation path captured at wrap time, used to resolve account-scope bindings. Captured here rather than re-read from `account.path` on each call so a later change to `account.path` cannot make a path-bound rule miss.
 * @property {number | undefined} index - The index passed to `wdk.getAccount(wallet, index)`, when the account
 *   was retrieved that way.
 * @property {PolicyEngine} engine - The engine that evaluates each intercepted call.
 */

const PROTOCOL_CATEGORIES = {
  getSwapProtocol: 'swap',
  getBridgeProtocol: 'bridge',
  getLendingProtocol: 'lending',
  getFiatProtocol: 'fiat',
  getSwidgeProtocol: 'swidge',
  getSdaProtocol: 'sda'
}

const PROTOCOL_GETTERS = Object.keys(PROTOCOL_CATEGORIES)

const EMPTY_METHODS = new Map()

const governedMethodCache = new WeakMap()

function isProtectedMember (prop) {
  return prop === 'keyPair' || (typeof prop === 'string' && prop.startsWith('_'))
}

/**
 * Wraps `subject` in a Proxy that serves `substitutions` in place of its own
 * members, hides protected members, and governs any callable the subject did
 * not expose at wrap time.
 *
 * Every trap applies the same rules so no reflective path disagrees: a `get`
 * trap alone would leave `getOwnPropertyDescriptor` handing back raw values
 * (e.g. `_signer`, or an unenforced protocol getter), and `has` / `ownKeys`
 * would still report hidden members. Substituted members describe as their
 * enforced value, and descriptors are reported only for members the subject
 * owns, so inherited methods still read as inherited.
 *
 * Only functions present at wrap time (`trusted`) run raw — the reads and
 * lifecycle methods handed through deliberately. Any callable that appears
 * later (assigned after wrap, added to the prototype, or a governed method
 * re-pointed onto an excluded name) is governed and bound to the proxy, so its
 * internal calls re-enter enforcement. `set` allows plain data writes (governed
 * on read); `defineProperty` refuses accessors and functions, which could
 * otherwise read protected state or be locked to serve raw. `preventExtensions`
 * is refused, since hiding members is only legal while the subject stays
 * extensible.
 *
 * @param {object} subject - The object to guard.
 * @param {Map<string, unknown>} substitutions - The members to serve in place of the subject's own.
 * @param {Set<Function>} trusted - Function identities present at wrap time that may run raw; every other callable is governed when read.
 * @param {EnforcementContext} ctx - The per-subject state used to govern callables discovered after wrap.
 * @returns {object} The guarded proxy.
 */
function createGuardedProxy (subject, substitutions, trusted, ctx) {
  const handle = { proxy: null }

  // Enforce a callable discovered after wrap, bound to the proxy so its
  // internal calls re-enter enforcement rather than escaping to the account.
  const govern = (prop, fn) => buildEnforcedMethod(String(prop), fn.bind(handle.proxy), ctx)

  handle.proxy = new Proxy(subject, {
    get (target, prop) {
      if (substitutions.has(prop)) return substitutions.get(prop)

      if (isProtectedMember(prop)) return undefined

      const value = Reflect.get(target, prop, target)

      if (typeof value !== 'function') return value

      // Inherited `Object.prototype` methods are left unbound so they keep the
      // proxy as `this`; binding `valueOf` to the target would unwrap the proxy.
      if (value === Object.prototype[prop]) return value

      // Wrap-time functions bind to the account (so internal `this.method()`
      // calls keep escaping the proxy); anything newer is governed.
      if (trusted.has(value)) return value.bind(target)

      return govern(prop, value)
    },

    getOwnPropertyDescriptor (target, prop) {
      if (isProtectedMember(prop)) return undefined

      const descriptor = Reflect.getOwnPropertyDescriptor(target, prop)

      if (descriptor === undefined) return descriptor

      if (substitutions.has(prop)) {
        return {
          value: substitutions.get(prop),
          writable: false,
          enumerable: descriptor.enumerable,
          configurable: true
        }
      }

      // Mirror `get`, or a descriptor read could call the raw function.
      if (typeof descriptor.value === 'function' && !trusted.has(descriptor.value) && descriptor.configurable) {
        return {
          value: govern(prop, descriptor.value),
          writable: false,
          enumerable: descriptor.enumerable,
          configurable: true
        }
      }

      return descriptor
    },

    has (target, prop) {
      if (substitutions.has(prop)) return true

      if (isProtectedMember(prop)) return false

      return Reflect.has(target, prop)
    },

    ownKeys (target) {
      return Reflect.ownKeys(target).filter((prop) => !isProtectedMember(prop))
    },

    // Write to the target directly, not via `receiver`, which would re-enter
    // `defineProperty` and refuse the write. An assigned callable then lands on
    // the account and is governed on read.
    set (target, prop, value) {
      return Reflect.set(target, prop, value)
    },

    defineProperty (target, prop, descriptor) {
      // Refuse accessors and functions: an accessor could read protected state,
      // and a function belongs on the governed-on-read path via `set`.
      if ('get' in descriptor || 'set' in descriptor || typeof descriptor.value === 'function') return false

      return Reflect.defineProperty(target, prop, descriptor)
    },

    preventExtensions () {
      return false
    }
  })

  return handle.proxy
}

/**
 * Builds the set of function identities the guarded proxy may serve raw: every
 * callable present at wrap time (walking the subject's own members and the full
 * prototype chain), minus the governed ones, which are always served through
 * their enforced substitution. Any callable appearing later is governed on read.
 *
 * @param {object} subject - The account or protocol being wrapped.
 * @param {Map<string, Function>} governedMethods - The methods being governed, keyed by name.
 * @returns {Set<Function>} The trusted function identities.
 */
function collectTrustedFunctions (subject, governedMethods) {
  const trusted = new Set()

  for (let o = subject; o && o !== Object.prototype; o = Object.getPrototypeOf(o)) {
    for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(o))) {
      if (typeof descriptor.value === 'function') trusted.add(descriptor.value)
    }
  }

  for (const method of governedMethods.values()) trusted.delete(method)

  return trusted
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

  const ctx = { account, readOnlyAccount, blockchain, path, index, engine }

  const substitutions = new Map()

  // Deny by default: govern every callable the account exposes except the
  // reads and lifecycle methods in the resolved exclusion set. An inclusion
  // list leaves any method it forgot silently unpoliced — the failure mode
  // that let Spark's payLightningInvoice bypass the engine entirely — so the
  // unknown method is governed and denies loudly instead.
  const governedMethods = collectGovernedMethods(account, engine)

  const enforcedOperations = [...governedMethods.keys()]

  for (const [op, method] of governedMethods) {
    substitutions.set(op, buildEnforcedMethod(op, method.bind(account), ctx))
  }

  // Late-bound reference to the proxy, so protocols build against it and
  // `registerProtocol` can hand it back.
  const handle = { proxy: null }

  for (const getterName of PROTOCOL_GETTERS) {
    if (typeof account._buildProtocol !== 'function') break

    const category = PROTOCOL_CATEGORIES[getterName]

    substitutions.set(getterName, (label) => {
      // Build against the proxy so the protocol's own account calls are gated.
      const protocol = account._buildProtocol(category, label, handle.proxy)

      return wrapProtocolInProxy(protocol, ctx)
    })
  }

  substitutions.set('simulate', buildSimulateMirror(enforcedOperations, ctx, handle))

  // `registerProtocol` returns the raw account by design; rewrite it to the
  // proxy so chained `.registerProtocol(...).sendTransaction(...)` stays gated.
  if (typeof account.registerProtocol === 'function') {
    const registerProtocol = account.registerProtocol.bind(account)

    substitutions.set('registerProtocol', (...args) => {
      registerProtocol(...args)

      return handle.proxy
    })
  }

  const trusted = collectTrustedFunctions(account, governedMethods)

  handle.proxy = createGuardedProxy(account, substitutions, trusted, ctx)

  return handle.proxy
}

/**
 * Builds the enforced replacement for one wrapped method: evaluate first, then
 * forward to the original only on ALLOW.
 *
 * @param {string} name - The operation name being wrapped.
 * @param {(...args: unknown[]) => unknown} boundOriginal - The underlying method, pre-bound to its subject.
 * @param {EnforcementContext} ctx - The per-account state shared by every wrapped method.
 * @returns {(...args: unknown[]) => Promise<unknown>} The enforced method, which throws
 *   {@link PolicyViolationError} on a BLOCK verdict and {@link PolicyConfigurationError} if an argument is not
 *   structured-cloneable.
 */
function buildEnforcedMethod (name, boundOriginal, ctx) {
  return async function policyEnforced (...args) {
    const forwardedArgs = snapshotArgs(args, name)

    const context = buildContext({
      operation: name,
      wallet: ctx.blockchain,
      account: ctx.readOnlyAccount,
      args: forwardedArgs
    })

    const verdict = await ctx.engine._evaluateContext(context, { path: ctx.path, index: ctx.index })

    if (verdict.outcome === 'BLOCK') {
      throw new PolicyViolationError({
        operation: name,
        policyId: verdict.policyId ?? '<unknown>',
        ruleName: verdict.ruleName ?? '<unknown>',
        reason: verdict.reason ?? 'unknown',
        code: verdict.code
      })
    }

    return boundOriginal(...forwardedArgs)
  }
}

/**
 * Collects every callable member the subject exposes, walking the full
 * prototype chain, minus the exclusion set and the members the guarded proxy
 * already hides.
 *
 * Members are read through their property descriptors rather than by access,
 * so an accessor is classified without ever being invoked: a getter that
 * happens to return a function is not a method, and evaluating one for
 * classification could throw or have side effects.
 *
 * Own members are collected fresh on every call and shadow inherited ones,
 * because they vary per instance — the WDK installs `registerProtocol` and the
 * protocol getters directly onto each account. Only the prototype chain is
 * cached; see {@link inheritedGovernedMethods}.
 *
 * @param {object} subject - The account or protocol whose surface is being governed.
 * @param {PolicyEngine} engine - The engine whose exclusion set decides what is skipped.
 * @returns {Map<string, Function>} The methods to wrap, keyed by name, valued by the unbound function.
 */
function collectGovernedMethods (subject, engine) {
  const methods = new Map()

  collectCallableMembers(subject, engine, methods)

  for (const [name, method] of inheritedGovernedMethods(Object.getPrototypeOf(subject), engine)) {
    if (!methods.has(name)) methods.set(name, method)
  }

  return methods
}

/**
 * Returns the governed methods reachable from a prototype, memoised per
 * (engine, prototype) pair.
 *
 * The result is a pure function of the prototype chain and the engine's
 * exclusion set, and the exclusion set is fixed at construction — so every
 * instance of a class resolves to the same answer.
 *
 * Cached functions are unbound; the caller binds them to its own instance.
 *
 * @param {object | null} prototype - Start of the chain to walk, normally `Object.getPrototypeOf(subject)`. Null and `Object.prototype` short-circuit to an empty result.
 * @param {PolicyEngine} engine - The engine whose exclusion set decides what is skipped.
 * @returns {Map<string, Function>} The inherited governed methods. Shared — callers must not mutate it.
 */
function inheritedGovernedMethods (prototype, engine) {
  if (prototype === null || prototype === Object.prototype) return EMPTY_METHODS

  let perPrototype = governedMethodCache.get(engine)

  if (perPrototype === undefined) {
    perPrototype = new WeakMap()
    governedMethodCache.set(engine, perPrototype)
  }

  let methods = perPrototype.get(prototype)

  if (methods === undefined) {
    methods = new Map()

    for (let o = prototype; o && o !== Object.prototype; o = Object.getPrototypeOf(o)) {
      collectCallableMembers(o, engine, methods)
    }

    perPrototype.set(prototype, methods)
  }

  return methods
}

function collectCallableMembers (subject, engine, methods) {
  for (const [name, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(subject))) {
    if (methods.has(name)) continue
    if (name === 'constructor' || isProtectedMember(name)) continue
    if (engine.isExcluded(name)) continue
    if (typeof descriptor.value !== 'function') continue

    methods.set(name, descriptor.value)
  }
}

function wrapProtocolInProxy (protocol, ctx) {
  const substitutions = new Map()
  const governedMethods = collectGovernedMethods(protocol, ctx.engine)

  for (const [name, method] of governedMethods) {
    substitutions.set(name, buildEnforcedMethod(name, method.bind(protocol), ctx))
  }

  const trusted = collectTrustedFunctions(protocol, governedMethods)

  return createGuardedProxy(protocol, substitutions, trusted, ctx)
}

/**
 * Builds the `simulate` mirror: a method per governed operation that evaluates
 * policy without executing. Since it never runs the operation, it only checks
 * the operation named, not the account calls that operation would make at run
 * time. (For a protocol added via `account.registerProtocol` a real call does
 * evaluate those internal calls too; a `wdk.registerProtocol` protocol runs on
 * the raw account, so its internal calls are not evaluated.)
 *
 * @param {string[]} methodNames - The governed operation names to mirror.
 * @param {EnforcementContext} ctx - The per-account enforcement state.
 * @param {{ proxy: object }} handle - Late-bound reference to the enforced proxy.
 * @returns {object} The `simulate` surface.
 */
function buildSimulateMirror (methodNames, ctx, handle) {
  const simulate = Object.create(null)

  for (const name of methodNames) {
    simulate[name] = async (...args) => {
      const context = buildContext({
        operation: name,
        wallet: ctx.blockchain,
        account: ctx.readOnlyAccount,
        args
      })

      return ctx.engine._simulateContext(context, { path: ctx.path, index: ctx.index })
    }
  }

  for (const getterName of PROTOCOL_GETTERS) {
    if (typeof ctx.account._buildProtocol !== 'function') break

    const category = PROTOCOL_CATEGORIES[getterName]

    // Build against the proxy, like the enforced getter, so a per-account
    // protocol never receives the raw account here. Enumerate the protocol's
    // own methods rather than a fixed verb list, so simulate mirrors exactly
    // the surface the engine governs.
    simulate[getterName] = (label) => {
      const out = Object.create(null)

      const protocol = ctx.account._buildProtocol(category, label, handle.proxy)

      for (const method of collectGovernedMethods(protocol, ctx.engine).keys()) {
        out[method] = async (...args) => {
          const context = buildContext({
            operation: method,
            wallet: ctx.blockchain,
            account: ctx.readOnlyAccount,
            args
          })

          return ctx.engine._simulateContext(context, { path: ctx.path, index: ctx.index })
        }
      }

      return out
    }
  }

  return simulate
}
