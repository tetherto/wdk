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

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { build } from 'esbuild'

const here = dirname(fileURLToPath(import.meta.url))

/**
 * Bundles the example for the browser.
 *
 * A bundler is required rather than optional: bip39, reached through
 * @tetherto/wdk-wallet, is published as CommonJS, which no browser can load
 * natively. The `inject` below supplies the `Buffer` global that same package
 * expects. Both concerns belong to that dependency, not to the WDK.
 *
 * @returns {Promise<string>} The path of the bundle that was written.
 */
export async function buildExample () {
  const outfile = join(here, 'dist', 'bundle.js')

  await build({
    entryPoints: [join(here, 'main.js')],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    inject: [join(here, 'buffer-shim.js')]
  })

  return outfile
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildExample().then((outfile) => console.log(`Built ${outfile}`))
}
