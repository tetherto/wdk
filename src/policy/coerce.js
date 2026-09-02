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

const DECIMAL_INTEGER = /^\d+$/

/**
 * Coerces a caller-supplied amount into a non-negative `bigint`, or
 * `undefined` when the value cannot be represented safely. Returns
 * `undefined` (rather than throwing) for `null`, `undefined`, negative
 * numbers, non-integer numbers, `NaN`, unsafe integers, and strings that
 * are not plain decimal integers, so a policy sees "amount unknown" and
 * applies its own fail-closed rule instead of the extractor crashing.
 *
 * Negative amounts are rejected on purpose: a negative value would
 * decrement a cumulative cap on commit.
 *
 * @param {unknown} value - The raw amount from the method arguments.
 * @returns {bigint | undefined} The amount in base units, or `undefined` if unusable.
 */
export function coerceAmount (value) {
  if (typeof value === 'bigint') return value < 0n ? undefined : value
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0) return undefined
    return BigInt(value)
  }
  if (typeof value === 'string' && DECIMAL_INTEGER.test(value)) return BigInt(value)
  return undefined
}
