# Agent Guide

This repository is part of the Tether WDK (Wallet Development Kit) ecosystem. It follows strict coding conventions and tooling standards to ensure consistency, reliability, and cross-platform compatibility (Node.js and Bare runtime).

## Project Overview
- **Architecture:** Modular architecture with clear separation between Core, Wallet managers, and Protocols.
- **Runtime:** Supports both Node.js and Bare runtime.

## Tech Stack & Tooling
- **Language:** JavaScript (ES2015+).
- **Module System:** ES Modules (`"type": "module"` in package.json).
- **Type Checking:** TypeScript is used purely for generating type declarations (`.d.ts`). The source code remains JavaScript.
  - Command: `npm run build:types`
- **Linting:** `standard` (JavaScript Standard Style).
  - Command: `npm run lint` / `npm run lint:fix`
- **Testing:** `jest` (configured with `experimental-vm-modules` for ESM support).
  - Command: `npm test`
- **Dependencies:** `cross-env` is consistently used for environment variable management in scripts.

## Coding Conventions
- **File Naming:** Kebab-case (e.g., `wallet-manager.js`).
- **Class Naming:** PascalCase (e.g., `WDK`).
- **Private Members:** Prefixed with `_` (underscore) and explicitly documented with `@private`.
- **Imports:** Explicit file extensions are mandatory (e.g., `import ... from './file.js'`).
- **Copyright:** All source files must include the standard Tether copyright header.

## Documentation (JSDoc)
Source code must be strictly typed using JSDoc comments to support the `build:types` process.
- **Types:** Use `@typedef` to define or import types.
- **Methods:** Use `@param`, `@returns`, `@throws`.
- **Generics:** Use `@template`.

## Development Workflow
1.  **Install:** `npm install`
2.  **Lint:** `npm run lint`
3.  **Test:** `npm test`
4.  **Build Types:** `npm run build:types`

## Key Files
- `index.js`: Main entry point.
- `bare.js`: Entry point for Bare runtime optimization.
- `src/`: Core logic.
- `types/`: Generated type definitions (do not edit manually).

## Repository Specifics
- **Domain:** Core Orchestrator.
- **Role:** Central entry point for the WDK. Manages lifecycle of multiple wallet instances, protocols, and transaction policies.
- **Key Pattern:** Dependency Injection (registerWallet, registerProtocol, registerPolicy).
- **Architecture:** `WDK` class manages a collection of `WalletManager` instances and a `PolicyEngine` that intercepts write-facing operations on every account returned from `getAccount` / `getAccountByPath`.

## Policy Engine
- Source lives under `src/policy/`. Public surface is the `PolicyViolationError` and `PolicyConfigurationError` classes plus the `Policy*` / `SimulationResult` typedefs re-exported from `index.js`. Everything else under `src/policy/` is internal.
- The engine wraps account write methods and protocol getters at `getAccount` time. When any policy applies to an account ("governed"), the proxy wraps **every** method in `OPERATIONS` that exists on the underlying account — not just the ones referenced by registered rules. Combined with the default-deny evaluator (below) this closes sibling-method bypasses (e.g. a "cap transfer" policy cannot be sidestepped by `sendTransaction({ to: token, data: ERC-20-transfer-calldata })`, `approve` to an attacker, off-chain Permit via `signTypedData`, or ERC-7702 `delegate`).
- **Default-deny on governed accounts.** `policy-evaluator.evaluate()` returns BLOCK with `reason: 'no-applicable-rule'` whenever an operation reaches it and no rule addresses that operation. To opt into permissive semantics on a specific account, register a wildcard ALLOW baseline (`operation: '*', action: 'ALLOW'`) and layer specific DENYs on top. Accounts with no registered policies are not governed and skip the proxy entirely (zero cost).
- **Operation name = canonical IWalletAccount method name.** The engine wraps `account[op]` by string lookup, so every entry in `OPERATIONS` (`src/policy/constants.js`) must match the exact method name on `@tetherto/wdk-wallet`'s base `IWalletAccount` or a registered protocol class. A divergence silently no-ops the policy (registers fine, never fires) — which is worse than a hard error. When adding a new wallet method that emits a signature or moves value (e.g., `signTransaction`, `sign`), add it to `OPERATIONS` and the `PolicyOperation` typedef. Conversely, do not add aspirational entries that no wallet implements; the schema accepts them, but they produce silently-broken policies.
- Two scopes only: `project` (with optional wallet restriction declared via the policy's `wallet` field) and `account` (with required `wallet` field and a per-account `accounts` list of paths and/or integer indexes). The `wallet` value is the same string passed to `registerWallet` — an opaque consumer-chosen key, not a blockchain identifier. `wallet` accepts a single string or a non-empty array of strings; omitting it on a project-scope policy applies it across every registered wallet. DENY wins across scopes; account-scope `ALLOW` rules can short-circuit project-scope DENYs via `override_broader_scope: true`.
- Index-form `accounts` entries match the index passed to `wdk.getAccount(wallet, index)`. They do not match accounts retrieved via `getAccountByPath` because the wallet manager has no synchronous path → index resolver. Path-form entries match either retrieval style.
- Nested-call escape works via a `Proxy` (see `src/policy/policy-account-proxy.js`), not an async-context marker. The engine returns a Proxy that exposes enforced versions of write methods; the proxy's `get` trap binds non-enforced methods to the underlying account, so internal `this.method()` calls and protocol code that holds a direct reference to the account naturally bypass enforcement. The policy engine itself does not mutate the account (the WDK's `_registerProtocols` step does install `registerProtocol` / `getXProtocol` helpers before the proxy is built — separate, pre-existing concern). The same code path runs on every JavaScript runtime that supports `Proxy` — no `AsyncLocalStorage`, no runtime detection, no Bare-specific fallback.
- Enforcement applies to the **surface of the proxy** only. Underscore-prefixed fields (e.g. `protocol._account`) reach the raw account and bypass enforcement by design — they are private by convention and not part of the supported surface. The same is true for protocol methods that internally call account operations via their stored `this._account` (e.g. `bridge.bridge(...)` calling `this._account.sendTransaction(...)`); this is the documented nested-call escape.
- `proxy.registerProtocol(...)` is special: the underlying helper returns the raw account, so the `get` trap rewrites the return value to be the proxy itself. Without this rewrite, `proxy.registerProtocol(...).sendTransaction(...)` would skip enforcement.
- Each condition is raced against `conditionTimeoutMs` (default 30s, settable per `registerPolicy` call via `RegisterPolicyOptions`). The timeout is **per-policy**: it is resolved at registration time, clamped to the engine ceiling, and stored on the registry record, so registration order never changes the timeout another policy is evaluated under. The ceiling is `maxConditionTimeoutMs` (default 30s), set once via `new WDK(seed, options)`; a policy requesting more is capped, not rejected. A condition that throws or times out is fail-closed for DENY rules (treated as matched → block) and fail-open-as-no-match for ALLOW rules.
- Conditions are user-supplied functions in Phase 1. The engine accepts `state` and `onSuccess` rule fields for Phase 2 (engine-managed state + post-execution hooks) but ignores them at runtime; `state` is deep-cloned at registration so callers can't mutate engine state post-registration.
- Tests live in `tests/wdk-policy.test.js` and exercise the engine exclusively through the public WDK API.
