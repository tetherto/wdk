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

import WDK, { PolicyViolationError } from '@tetherto/wdk'

import DemoWalletManager from './demo-wallet.js'

/**
 * Runs the same flow the README's quick start describes, in the browser: seed
 * utilities, wallet registration, account retrieval, fee rates, a middleware hook,
 * and a policy that allows one transaction and blocks another.
 *
 * @returns {Promise<Record<string, unknown>>} What each step produced.
 */
export async function runBrowserExample () {
  const seedPhrase = WDK.getRandomSeedPhrase(12)

  const seen = []

  const wdk = new WDK(seedPhrase)
    .registerWallet('demo', DemoWalletManager, {})
    .registerMiddleware('demo', async (account) => {
      seen.push(await account.getAddress())
    })
    .registerPolicy({
      id: 'value-cap',
      name: 'Cap value at 100',
      scope: 'project',
      rules: [{
        name: 'allow-up-to-100',
        operation: 'sendTransaction',
        action: 'ALLOW',
        conditions: [({ args }) => BigInt(args[0].value) <= 100n]
      }]
    })

  const account = await wdk.getAccount('demo', 0)
  const byPath = await wdk.getAccountByPath('demo', "0'/0/7")
  const feeRates = await wdk.getFeeRates('demo')

  const allowed = await account.sendTransaction({ value: 10n })

  let denied
  try {
    await account.sendTransaction({ value: 1000n })
    denied = 'not blocked'
  } catch (error) {
    denied = error instanceof PolicyViolationError
      ? error.code
      : `unexpected error: ${error.message}`
  }

  const simulation = await account.simulate.sendTransaction({ value: 1000n })

  wdk.dispose()

  return {
    seedPhraseWords: seedPhrase.split(' ').length,
    seedPhraseValid: WDK.isValidSeed(seedPhrase),
    address: await account.getAddress(),
    addressByPath: await byPath.getAddress(),
    fastFeeRate: feeRates.fast.toString(),
    middlewareSaw: seen.length,
    allowed,
    denied,
    simulated: simulation.decision
  }
}

/* global document */

// Exposed so a browser test can await the same flow the page renders.
globalThis.runBrowserExample = runBrowserExample

runBrowserExample()
  .then((result) => {
    document.querySelector('#output').textContent = JSON.stringify(result, null, 2)
  })
  .catch((error) => {
    document.querySelector('#output').textContent = `Failed: ${error.message}`
  })
