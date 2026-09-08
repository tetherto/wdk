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
 * Public surface of the policy engine sub-module.
 *
 * Re-exports the error classes, the public constants (`DEFAULT_POLICY_EXCLUSIONS`,
 * `DENIAL_CODES`), and the typedefs consumers need to type their policies,
 * conditions, and simulation results. The registry, evaluator, validators,
 * wrapper, and context modules are not re-exported here — they're
 * implementation details.
 */

/** @typedef {import('./policy-engine.js').Policy} Policy */
/** @typedef {import('./policy-engine.js').PolicyRule} PolicyRule */
/** @typedef {import('./policy-engine.js').PolicyCondition} PolicyCondition */
/** @typedef {import('./policy-engine.js').PolicyContext} PolicyContext */
/** @typedef {import('./policy-engine.js').PolicyAction} PolicyAction */
/** @typedef {import('./policy-engine.js').PolicyScope} PolicyScope */
/** @typedef {import('./policy-engine.js').PolicyOperation} PolicyOperation */
/** @typedef {import('./policy-engine.js').SimulationResult} SimulationResult */
/** @typedef {import('./policy-engine.js').SimulationTraceEntry} SimulationTraceEntry */
/** @typedef {import('./policy-engine.js').RegisterPolicyOptions} RegisterPolicyOptions */
/** @typedef {import('./policy-error.js').DenialCode} DenialCode */

export { default as PolicyViolationError, PolicyConfigurationError } from './policy-error.js'
export { DEFAULT_POLICY_EXCLUSIONS, DENIAL_CODES } from './constants.js'
