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

/**
 * The complete set of write-facing operations the policy engine wraps in Phase 1.
 * The wildcard `*` matches any of them.
 *
 * @internal
 */
export const OPERATIONS = Object.freeze([
  'sendTransaction',
  'transfer',
  'approve',
  'signMessage',
  'signHash',
  'signTypedData',
  'signAuthorization',
  'delegate',
  'revokeDelegation',
  'swap',
  'bridge',
  'supply',
  'withdraw',
  'borrow',
  'repay',
  'buy',
  'sell'
])

/** @internal */
export const OPERATIONS_SET = new Set(OPERATIONS)

/** @internal */
export const WILDCARD = '*'

/** @internal */
export const SCOPES = Object.freeze(['project', 'wallet', 'account'])

/** @internal */
export const ACTIONS = Object.freeze(['ALLOW', 'DENY'])

/**
 * Maps each protocol type to the methods on its instances that the engine wraps.
 * Quote variants are intentionally absent.
 *
 * @internal
 */
export const PROTOCOL_METHODS = Object.freeze({
  swap: ['swap'],
  bridge: ['bridge'],
  lending: ['supply', 'withdraw', 'borrow', 'repay'],
  fiat: ['buy', 'sell']
})
