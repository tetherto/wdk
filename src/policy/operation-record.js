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

/** @typedef {import('@tetherto/wdk-wallet').IWalletAccountReadOnly} IWalletAccountReadOnly */

/**
 * Semantic categories for shipped operations. These are the canonical values
 * every shipped adapter emits and every shipped policy understands. Consumers
 * are free to invent additional kinds for their own workflows (e.g. `stake`,
 * `vote`, `bridge-lock`); shipped policies simply ignore records whose kind
 * they don't recognize.
 *
 * - `spend`     — value leaves the account.
 * - `sign`      — an arbitrary message or typed payload is signed; no value moves and no allowance is granted.
 * - `sign-tx`   — a pre-formed transaction is signed without being broadcast.
 * - `approve`   — an allowance is granted to a spender, on-chain or via an off-chain typed-data permit.
 * - `authorize` — account-level control is delegated (ERC-7702). Kept distinct from `sign` because allowing it is materially riskier than allowing message signing.
 * - `swap`      — one asset in, another out.
 * - `batch`     — a composite of sub-operations; see `items`.
 * - `other`     — recognized but with no canonical mapping.
 *
 * @see https://eips.ethereum.org/EIPS/eip-7702
 * @typedef {'spend'|'sign'|'sign-tx'|'approve'|'authorize'|'swap'|'batch'|'other'} CanonicalOperationKind
 */

/**
 * Pointer back to the original call, for policies that need to inspect
 * caller-specific context beyond the canonical baseline fields.
 *
 * @typedef {Object} OperationRaw
 * @property {string}                 walletType - The wallet identifier the call was made against (the same string passed to `registerWallet`).
 * @property {string}                 method     - The method name that was intercepted.
 * @property {readonly unknown[]}     args       - The arguments the caller passed, snapshotted at evaluation time.
 * @property {IWalletAccountReadOnly} [account]  - A read-only view of the account the call was made on, when the engine supplies it. Rule-shaped policies expose it to their condition functions as `context.account`.
 * @property {string}                 [path]     - The account's derivation path, when the engine supplies it. Account-scope bindings that list paths match against it.
 * @property {number}                 [index]    - The index passed to `wdk.getAccount(wallet, index)`, when the account was retrieved that way. Read-only views do not expose it, so it travels separately; account-scope bindings that list integer indexes match against it.
 */

/**
 * Canonical, adapter-produced description of a single intercepted operation.
 *
 * This shape is a **baseline**, not a lock. Every shipped adapter is
 * guaranteed to populate at least the fields listed below for its operation
 * kind. Adapters may attach any additional fields on top; shipped policies
 * only rely on the baseline, but consumer policies are free to read
 * whatever their paired adapter produces.
 *
 * The `kind` field is typed as `string` on purpose. Consumers with
 * domain-specific operations invent their own kinds and write policies
 * that match on those.
 *
 * Chain-specific structures (`tx`, typed-data `domain` and `types`) are
 * deliberately untyped here because this record is chain-agnostic; the
 * adapter that produced the record documents the concrete shape.
 *
 * @typedef {Object} OperationRecord
 * @property {string}                  kind          - Semantic category. See `CanonicalOperationKind` for the shipped set; consumer-defined values are permitted.
 * @property {string}                  [asset]       - Asset identifier: the chain's native symbol sentinel (`ETH`, `BTC`, ...) or a token contract address.
 * @property {bigint}                  [amount]      - Amount in the asset's smallest base unit. Always non-negative when present; absent when it could not be determined.
 * @property {string}                  [destination] - Recipient address, invoice, delegate contract, or equivalent target of the operation.
 * @property {string}                  [spender]     - For `approve` operations, the address being granted allowance.
 * @property {{asset: string, amount: bigint}} [input]  - For `swap` operations, the asset and amount consumed.
 * @property {{asset: string, amount: bigint}} [output] - For `swap` operations, the asset and amount produced.
 * @property {string|Uint8Array|Record<string, unknown>} [message] - For `sign` operations, the message or typed-data message being signed.
 * @property {Record<string, unknown>} [domain]      - For typed-data signatures, the domain separator fields.
 * @property {Record<string, unknown>} [types]       - For typed-data signatures, the type definitions.
 * @property {string}                  [primaryType] - For typed-data signatures, the primary type name when it can be determined.
 * @property {Record<string, unknown>} [tx]          - For `sign-tx` operations, the pre-formed transaction being signed.
 * @property {OperationRecord[]}       [items]       - For `batch` operations, the sub-records composing the batch.
 * @property {OperationRaw}            raw           - Original call information for policies needing extra context.
 */

export {}
