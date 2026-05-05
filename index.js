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

/** @typedef {import('./src/wdk-manager.js').IWalletAccount} IWalletAccount */
/** @typedef {import('@tetherto/wdk-wallet').IWalletAccountReadOnly} IWalletAccountReadOnly */
/** @typedef {import('./src/wdk-manager.js').FeeRates} FeeRates */
/** @typedef {import('./src/wdk-manager.js').MiddlewareFunction} MiddlewareFunction */

/** @typedef {import('./src/wallet-account-with-protocols.js').IWalletAccountWithProtocols} IWalletAccountWithProtocols */

/** @typedef {import('./src/policy/index.js').Policy} Policy */
/** @typedef {import('./src/policy/index.js').PolicyRule} PolicyRule */
/** @typedef {import('./src/policy/index.js').PolicyCondition} PolicyCondition */
/** @typedef {import('./src/policy/index.js').PolicyContext} PolicyContext */
/** @typedef {import('./src/policy/index.js').PolicyAction} PolicyAction */
/** @typedef {import('./src/policy/index.js').PolicyScope} PolicyScope */
/** @typedef {import('./src/policy/index.js').PolicyOperation} PolicyOperation */
/** @typedef {import('./src/policy/index.js').SimulationResult} SimulationResult */
/** @typedef {import('./src/policy/index.js').SimulationTraceEntry} SimulationTraceEntry */
/** @typedef {import('./src/policy/index.js').RegisterPolicyOptions} RegisterPolicyOptions */

export { default } from './src/wdk-manager.js'
export { PolicyViolationError, PolicyConfigurationError } from './src/policy/index.js'
