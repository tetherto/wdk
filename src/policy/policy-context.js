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

/** @typedef {import('@tetherto/wdk-wallet').IWalletAccountReadOnly} IWalletAccountReadOnly */

/**
 * Builds the immutable context object passed to every condition function.
 *
 * Each cloneable argument is passed through structuredClone so condition
 * functions see a snapshot taken at evaluation time. This prevents
 * time-of-check / time-of-use mutation: a caller mutating the original
 * tx object after the wrapper builds the context (e.g., concurrent
 * middleware on a shared request body) cannot change what the conditions
 * already evaluated. The original arguments still flow through to the
 * underlying method untouched. Arguments that aren't structured-cloneable
 * (functions, class instances with non-cloneable internals) fall back to
 * their raw value.
 *
 * @internal
 * @param {object} input
 * @param {string} input.operation - The wrapped operation name (e.g. 'sendTransaction').
 * @param {string} input.chain - The blockchain identifier.
 * @param {IWalletAccountReadOnly} input.account - A read-only view of the wallet account.
 * @param {readonly unknown[]} input.args - The full argument array passed to the method.
 * @returns {object} A frozen context object: { operation, chain, account, params, args }.
 */
export function buildContext ({ operation, chain, account, args }) {
  const safeArgs = Object.freeze(Array.from(args, snapshot))

  return Object.freeze({
    operation,
    chain,
    account,
    params: safeArgs[0],
    args: safeArgs
  })
}

function snapshot (value) {
  if (value === null || typeof value !== 'object') return value

  try {
    return structuredClone(value)
  } catch {
    return value
  }
}
