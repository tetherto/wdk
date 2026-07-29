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

// Every entry must be the exact method name on `@tetherto/wdk-wallet`'s
// IWalletAccount or an installed protocol class. The engine wraps methods by
// looking them up on the account by name — a mismatch silently no-ops, which
// is worse than a hard error. Audit upstream wallets before adding/removing.
export const OPERATIONS = [
  'sendTransaction',
  'signTransaction',
  'transfer',
  'approve',
  'sign',
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
  'sell',
  'swidge',
  'createDepositAddress',
  'renewDepositAddress',
  'recoverDepositAddress',
  'disableDepositAddress'
]

export const WILDCARD = '*'

export const SCOPES = ['project', 'account']

export const ACTIONS = ['ALLOW', 'DENY']

export const PROTOCOL_METHODS = {
  swap: ['swap'],
  bridge: ['bridge'],
  lending: ['supply', 'withdraw', 'borrow', 'repay'],
  fiat: ['buy', 'sell'],
  swidge: ['swidge'],
  sda: ['createDepositAddress', 'renewDepositAddress', 'recoverDepositAddress', 'disableDepositAddress']
}
