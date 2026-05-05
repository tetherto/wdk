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
- **Class Naming:** PascalCase (e.g., `WdkManager`).
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
- The engine wraps account write methods and protocol getters at `getAccount` time. Wrapping is dynamic — only methods named in registered rules are wrapped, and only when at least one policy applies.
- The "in policy context" marker uses `AsyncLocalStorage` (per-async-chain) so concurrent calls on the same account each evaluate independently, while nested calls within one chain still skip re-evaluation.
- Conditions are user-supplied functions in Phase 1. The engine accepts `state` and `onSuccess` rule fields for Phase 2 (engine-managed state + post-execution hooks) but ignores them at runtime.
- Tests live in `tests/wdk-manager-policy.test.js` and exercise the engine exclusively through the public WDK API.
