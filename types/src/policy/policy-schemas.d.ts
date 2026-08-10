/**
 * Normalises the wallet field of a parsed policy into an array of
 * non-empty strings or `undefined` (meaning "apply to every registered wallet").
 *
 * @internal
 * @param {string | string[] | undefined} wallet - The raw `wallet` field from a parsed policy.
 * @returns {string[] | undefined} Normalised wallet list, or undefined for "all wallets".
 */
export function normalisePolicyWallet(wallet: string | string[] | undefined): string[] | undefined;
/**
 * Builds a human-readable message for the first issue in a ZodError,
 * prefixed with the policy (and rule, when applicable) context.
 *
 * @internal
 * @param {ZodError} zodError - The error returned by `policySchema.safeParse`.
 * @param {Policy} policy - The policy candidate that failed validation; used to look up id and rule names for the prefix.
 * @returns {string} A human-readable message prefixed with the policy (and rule, where applicable) context.
 */
export function formatPolicyError(zodError: ZodError, policy: Policy): string;
/**
 * Builds a human-readable message for the first issue in a ZodError thrown
 * by the registerOptions schema.
 *
 * @internal
 * @param {ZodError} zodError - The error returned by `registerOptionsSchema.safeParse`.
 * @returns {string} A human-readable message prefixed with `registerPolicy options`.
 */
export function formatRegisterOptionsError(zodError: ZodError): string;
/**
 * Builds a human-readable message for the first issue in a ZodError thrown
 * by the engine options schema.
 *
 * @internal
 * @param {ZodError} zodError - The error returned by `engineOptionsSchema.safeParse`.
 * @returns {string} A human-readable message prefixed with `WDK options`.
 */
export function formatEngineOptionsError(zodError: ZodError): string;
/**
 * Zod schema for a single policy object. Validates id/name/scope/rules and
 * enforces cross-field rules (account-scope requirements, override constraint)
 * via a superRefine.
 */
export const policySchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    scope: z.ZodEnum<{
        [x: string]: string;
    }>;
    wallet: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    accounts: z.ZodOptional<z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>>;
    rules: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        reason: z.ZodOptional<z.ZodString>;
        operation: z.ZodUnion<readonly [z.ZodEnum<{
            [x: string]: string;
        }>, z.ZodArray<z.ZodEnum<{
            [x: string]: string;
        }>>]>;
        action: z.ZodEnum<{
            [x: string]: string;
        }>;
        override_broader_scope: z.ZodOptional<z.ZodBoolean>;
        conditions: z.ZodArray<z.ZodCustom<any, any>>;
        state: z.ZodOptional<z.ZodUnknown>;
        onSuccess: z.ZodOptional<z.ZodCustom<any, any>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
/**
 * Zod schema for the optional `registerPolicy` options bag.
 */
export const registerOptionsSchema: z.ZodOptional<z.ZodObject<{
    state: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    conditionTimeoutMs: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>>;
/**
 * Zod schema for the optional engine options bag accepted by the `WDK`
 * and `PolicyEngine` constructors.
 */
export const engineOptionsSchema: z.ZodOptional<z.ZodObject<{
    maxConditionTimeoutMs: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>>;
export type ZodError = import("zod").ZodError;
export type Policy = import("./policy-engine.js").Policy;
import { z } from 'zod';
