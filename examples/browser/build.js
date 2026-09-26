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

import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx'

/**
 * Bundles the example for the browser.
 *
 * A bundler is required rather than optional: bip39, reached through
 * @tetherto/wdk-wallet, is published as CommonJS, which no browser can load
 * natively. The `inject` below supplies the `Buffer` global that same package
 * expects. Both concerns belong to that dependency, not to the WDK.
 *
 * The bundler's CLI is driven through npx rather than a declared dependency:
 * esbuild ships a postinstall script, which supply-chain scanners flag, and
 * this package's tree is no place for it. npx fetches the pinned version on
 * first run and caches it afterwards.
 *
 * @returns {Promise<string>} The path of the bundle that was written.
 */
export async function buildExample () {
  const outfile = join(here, 'dist', 'bundle.js')

  const code = await new Promise((resolve, reject) => {
    const child = spawn(NPX, [
      '--yes', 'esbuild@0.28.2',
      join(here, 'main.js'),
      '--bundle',
      `--outfile=${outfile}`,
      '--format=esm',
      '--platform=browser',
      '--target=es2022',
      `--inject:${join(here, 'buffer-shim.js')}`
    ], { stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', (c) => resolve(c ?? 1))
  })

  if (code !== 0) throw new Error(`esbuild exited with code ${code}`)

  return outfile
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildExample().then((outfile) => console.log(`Built ${outfile}`))
}
