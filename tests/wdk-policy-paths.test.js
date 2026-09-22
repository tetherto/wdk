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

import { afterEach, beforeEach, describe, expect, test } from '@jest/globals'

import WalletManagerEvm from '@tetherto/wdk-wallet-evm'

import WDK, { PolicyViolationError } from '../index.js'

const SEED_PHRASE = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const FULL_PATH = "m/44'/60'/0'/0/0"
const PATH_SUFFIX = "0'/0/0"

const signingPolicy = (path) => ({
  id: 'block-account-signing',
  name: 'Block signing for the selected account',
  scope: 'account',
  wallet: 'ethereum',
  accounts: [path],
  rules: [{ name: 'deny-sign', operation: 'sign', action: 'DENY', conditions: [] }]
})

describe('Account policy paths with a real EVM wallet', () => {
  let wdk

  beforeEach(() => {
    wdk = new WDK(SEED_PHRASE).registerWallet('ethereum', WalletManagerEvm)
  })

  afterEach(() => {
    wdk.dispose()
  })

  test.each(['index', 'path'])('the full path blocks signing when retrieved by %s', async (retrieval) => {
    const selected = await wdk.getAccount('ethereum', 0)
    expect(selected.path).toBe(FULL_PATH)
    wdk.registerPolicy(signingPolicy(selected.path))

    const governed = retrieval === 'index'
      ? await wdk.getAccount('ethereum', 0)
      : await wdk.getAccountByPath('ethereum', PATH_SUFFIX)

    await expect(governed.sign('policy path regression')).rejects.toBeInstanceOf(PolicyViolationError)

    // The exact-path policy must not block a different derived account.
    const other = await wdk.getAccount('ethereum', 1)
    await expect(other.sign('policy path regression')).resolves.toEqual(expect.any(String))
  })

  test('a derivation suffix does not select the full account path', async () => {
    wdk.registerPolicy(signingPolicy(PATH_SUFFIX))
    const account = await wdk.getAccount('ethereum', 0)
    expect(account.path).toBe(FULL_PATH)
    await expect(account.sign('policy path regression')).resolves.toEqual(expect.any(String))
  })
})
