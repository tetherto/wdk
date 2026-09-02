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
export function coerceAmount(value: unknown): bigint | undefined;
