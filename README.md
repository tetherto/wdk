# @tetherto/wdk

[![npm version](https://img.shields.io/npm/v/%40tetherto%2Fwdk?style=flat-square)](https://www.npmjs.com/package/@tetherto/wdk)
[![npm downloads](https://img.shields.io/npm/dw/%40tetherto%2Fwdk?style=flat-square)](https://www.npmjs.com/package/@tetherto/wdk)
[![license](https://img.shields.io/npm/l/%40tetherto%2Fwdk?style=flat-square)](https://github.com/tetherto/wdk/blob/main/LICENSE)
[![docs](https://img.shields.io/badge/docs-docs.wdk.tether.io-0A66C2?style=flat-square)](https://docs.wdk.tether.io/sdk/core-module)

**Note**: This package is currently in beta. Please test thoroughly in development environments before using in production.

A flexible manager for orchestrating WDK wallet and protocol modules through a single interface. This package lets you register blockchain-specific wallet managers, derive accounts, and coordinate multi-chain wallet flows from one WDK instance.

## About WDK

This module is part of the [**WDK (Wallet Development Kit)**](https://docs.wdk.tether.io/) project, which empowers developers to build secure, non-custodial wallets with unified blockchain access, stateless architecture, and complete user control.

For detailed documentation about the complete WDK ecosystem, visit [docs.wdk.tether.io](https://docs.wdk.tether.io).

## Installation

```bash
npm install @tetherto/wdk
```

## Quick Start

```javascript
import WDK from '@tetherto/wdk'
import WalletManagerSolana from '@tetherto/wdk-wallet-solana'
import WalletManagerTon from '@tetherto/wdk-wallet-ton'
import WalletManagerTron from '@tetherto/wdk-wallet-tron'

const seedPhrase = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

const wdk = new WDK(seedPhrase)
  .registerWallet('solana', WalletManagerSolana, {
    rpcUrl: 'https://api.devnet.solana.com',
    commitment: 'confirmed',
  })
  .registerWallet('ton', WalletManagerTon, {
    tonClient: { url: 'https://testnet.toncenter.com/api/v2/jsonRPC' },
  })
  .registerWallet('tron', WalletManagerTron, {
    provider: 'https://api.shasta.trongrid.io',
  })

const account = await wdk.getAccount('solana', 0)
const address = await account.getAddress()
console.log('Address:', address)

wdk.dispose()
```

## Key Capabilities

- **Wallet Registration**: Register multiple blockchain wallet managers through one WDK instance
- **Unified Account Access**: Retrieve accounts by chain, index, or derivation path through a consistent API
- **Multi-Chain Operations**: Coordinate balances, fee lookups, and transaction flows across registered chains
- **Protocol Registration Support**: Attach swap, bridge, lending, fiat, and swidge protocols to registered blockchains
- **Middleware Hooks**: Intercept account derivation with custom middleware
- **Transaction Policies**: Local policy engine that intercepts write-facing operations and enforces user-defined ALLOW/DENY rules at project (global or wallet-bound) and account scopes — with simulation, nested-call handling, and structured `PolicyViolationError`s
- **Seed Utilities**: Generate and validate BIP-39 seed phrases
- **Selective Disposal**: Dispose specific registered wallets or clear the full WDK instance

## Transaction Policies

Register policies on a `WDK` instance to gate write-facing operations on every wallet account. Each registered rule can `ALLOW` or `DENY` an attempted operation based on a condition function; matching `DENY`s throw a `PolicyViolationError` before the underlying method runs.

```javascript
import WDK, { PolicyViolationError } from '@tetherto/wdk'
import WalletManagerEvm from '@tetherto/wdk-wallet-evm'

const wdk = new WDK(seedPhrase)
  .registerWallet('ethereum', WalletManagerEvm, { provider: '...' })
  .registerPolicy({
    id: 'value-cap',
    name: 'Cap value at 1 ETH',
    scope: 'project',
    rules: [{
      name: 'allow-under-1-eth',
      operation: 'sendTransaction',
      action: 'ALLOW',
      conditions: [({ args }) => BigInt(args[0].value) <= 10n ** 18n]
    }]
  })

const account = await wdk.getAccount('ethereum', 0)

try {
  await account.sendTransaction({ to: '0x…', value: 5n * 10n ** 18n })
} catch (err) {
  if (err instanceof PolicyViolationError) {
    console.log(err.policyId, err.ruleName, err.reason)
  }
}

// Run the same evaluation without executing the transaction.
const result = await account.simulate.sendTransaction({ to: '0x…', value: 1n })
// → { decision: 'ALLOW' | 'DENY', policy_id, matched_rule, reason, trace }
```

Policies have two scopes — `project` and `account`. A project-scope policy applies globally by default, or only to the wallets named in its `wallet` field (`wallet: 'ethereum'` or `wallet: ['ethereum', 'ton']`). The `wallet` value is the same string passed to `registerWallet`. It might be a chain name like `"ethereum"`, but it could equally be `"treasury-cold"` or any label the consumer chose; the engine treats it as an opaque key. An account-scope policy must declare a `wallet` and targets specific accounts within it, identified by either derivation path (`accounts: ["0'/0/0"]`) or integer index (`accounts: [0, 1]`) — index entries match accounts retrieved via `wdk.getAccount(wallet, index)`; path entries match either retrieval style. Evaluation is narrowest-first with `DENY` winning across scopes. Account-scope `ALLOW` rules can opt into `override_broader_scope: true` to short-circuit broader policies for explicit exceptions (e.g., treasury accounts). Conditions can be sync or async and may carry user-owned state via closures. Templates (`@tetherto/wdk-policy-templates`) and a portal UI for editing policies are coming in later phases.

### Condition context

Every condition receives a single frozen context object with four fields: `operation` (the intercepted operation name), `wallet` (the identifier the account belongs to — the same string passed to `registerWallet`), `account` (a read-only view exposing reads and quotes but no signing or write methods), and `args` (the full argument array the call was made with, snapshotted at evaluation time).

Arguments are read positionally through `args`, which works for every operation shape — including multi-argument ones:

```javascript
// sendTransaction(tx) — the transaction is args[0]
conditions: [({ args }) => BigInt(args[0].value) <= 10n ** 18n]

// swidge(options, config) — slippage lives on options, the fee caps on config
conditions: [({ args }) => args[0].slippage <= 0.05]
conditions: [({ args }) => args[1] !== undefined && args[1].maxProtocolFeeBps <= 50]
```

Index positionally against the operation's real signature, and remember that trailing arguments are often optional — `swidge`'s `config` is. Reading a field off an argument that wasn't passed throws, and reading one that lives on a different argument silently yields `undefined`, which compares falsy: either way the rule stops guarding what you think it guards. Check the argument exists before reaching into it.

> **Breaking change:** `context.params`, a shortcut for `args[0]`, has been removed. It was invisible past the first argument, so multi-argument operations had to reach for `args` anyway. Migrate positional access to `args`:
>
> ```javascript
> // Before
> conditions: [({ params }) => params.to === '0x…']
>
> // After
> conditions: [({ args }) => args[0].to === '0x…']
> ```

### Method coverage

Coverage is **deny-by-default at the proxy layer**. The engine does not carry a list of methods it governs; it carries a list of methods it *doesn't*, and governs everything else.

That inversion is deliberate. Under an inclusion list, a wallet method the list has never heard of — a newly shipped `payLightningInvoice`, say — passes straight through to the signer with no evaluation and no error. The policy silently does not apply. Under deny-by-default the same unknown method is governed, so the worst case is a loud `PolicyViolationError` telling you to write a rule, instead of an unpoliced transfer.

```js
import { DEFAULT_POLICY_EXCLUSIONS } from '@tetherto/wdk'
```

`DEFAULT_POLICY_EXCLUSIONS` is a frozen array of method names that bypass the engine: balance and allowance lookups, `quote*` estimates, protocol capability queries, and lifecycle methods like `dispose` and `toReadOnlyAccount`. Its contents come from an audit of every `wdk-wallet-*` and `wdk-protocol-*` package in the org — see [`docs/policy-exclusions-audit.md`](docs/policy-exclusions-audit.md), which records how each method was classified and why. Anything absent from that list is governed.

Three rules worth knowing:

- **Accessors are never intercepted.** Only callable methods are wrapped, and the proxy classifies members through their property descriptors, so a getter is never invoked just to decide whether to wrap it.
- **Inherited methods are governed.** The proxy walks the prototype chain, so a method declared on a base account class is intercepted the same as an own method.
- **Accounts with no policies registered are untouched.** The proxy is not applied at all, so ungoverned use costs nothing.

#### Appending your own exclusions

Some legitimate reads are wallet-specific and did not qualify for the default list. Append them at construction:

```javascript
const wdk = new WDK(seedPhrase, {
  policyExclusions: ['syncWalletBalance']
})

wdk.getPolicyExclusions()  // frozen readonly string[] — defaults ∪ yours
```

`policyExclusions` is append-only — entries cannot be removed from the defaults, because removing one would gate a read call that consumers reasonably expect to work. Names are matched globally by method name, not per wallet. A name that matches nothing on any registered wallet is accepted without error, so you can add an exclusion ahead of the wallet release that introduces the method.

Spark is the one package in the org shipping a read that needs this: `syncWalletBalance` mutates local state and triggers server-side work, so it is governed by default. `getSingleUseDepositAddress` and `getStaticDepositAddress` are deliberately **not** offered as exclusions despite their `get*` names — both create remote state. If you need them callable, register an `ALLOW` rule so the call is still evaluated and traced.

#### Migrating from the inclusion-list model

Before this change the engine governed a fixed 22-method list. Now it governs everything outside the exclusion set, which means **more methods reach the engine than before**. If you registered policies against the old model:

- Calls that used to pass through unpoliced may now throw `PolicyViolationError` with `reason: 'no-applicable-rule'`. That is the bug being fixed — those calls were never evaluated.
- For a genuine read the default list missed, add it to `policyExclusions`.
- For a write you want to permit, register an `ALLOW` rule for it. Prefer this over an exclusion: the call stays evaluated, traced, and visible to `account.simulate`.
- A rule's `operation` may now name **any** method, not just one of the old 22. Rules for methods like `payLightningInvoice` register and fire normally.

### Default-deny semantics

The engine is **default-deny on governed accounts**. As soon as any policy applies to an account, the engine wraps **every callable method on that account**, walking the full prototype chain, except the reads and lifecycle methods listed in the exclusion set (see [Method coverage](#method-coverage)). Any call to a wrapped method whose operation is not addressed by an `ALLOW` rule throws `PolicyViolationError` with `reason: 'no-applicable-rule'`.

This is intentional: a "cap transfer at $100" policy must not be sidesteppable by `sendTransaction({ to: token, data: <ERC-20 transfer calldata> })`, `approve(spender, MAX)`, an off-chain `signTypedData` Permit, or an ERC-7702 `delegate` to an attacker contract. The engine closes those bypasses by treating any unaddressed money-movement op on a governed account as DENY.

If you want permissive semantics on a specific account (allow anything that isn't explicitly denied), register a wildcard ALLOW rule as a baseline and layer specific DENYs on top:

```javascript
wdk.registerPolicy({
  id: 'permissive-baseline',
  scope: 'project',
  rules: [
    { name: 'allow-all', operation: '*', action: 'ALLOW', conditions: [] },
    { name: 'block-bad', operation: 'sendTransaction', action: 'DENY', conditions: [({ args }) => isSanctioned(args[0].to)] }
  ]
})
```

Accounts that have **no** registered policies are not governed — the proxy is not applied, and method calls go straight to the underlying account at zero cost.

The engine wraps accounts through an ES `Proxy` so internal SDK code that uses `this.method()` naturally bypasses enforcement — nested-call escape (e.g. `bridge` internally calling `sendTransaction`) works without any async-context tracking. The same code path runs on every JavaScript runtime that supports `Proxy`, including Bare.

Policy enforcement applies to the **surface of the proxy** returned by `getAccount` / `getAccountByPath`. Reaching for underscore-prefixed fields (e.g. `protocol._account`) bypasses enforcement by design — treat them as private. The same applies to account-level operations invoked from inside a protocol's own methods (e.g. `bridge.bridge(...)` internally calling `this._account.sendTransaction(...)`), which is the documented nested-call escape; it lets protocols use the account they were constructed with without re-entering the engine on every internal step.

## Compatibility

- **WDK Wallet Modules** including EVM, Solana, TON, TRON, and Bitcoin integrations
- **Protocol Modules** registered through the WDK interface
- **Node.js and ESM-based applications** that coordinate multiple wallet modules in one runtime

## Documentation

| Topic | Description | Link |
|-------|-------------|------|
| Overview | Module overview and feature summary | [WDK Core Overview](https://docs.wdk.tether.io/sdk/core-module) |
| Usage | End-to-end integration walkthrough | [WDK Core Usage](https://docs.wdk.tether.io/sdk/core-module/usage) |
| Configuration | Wallet registration and manager configuration | [WDK Core Configuration](https://docs.wdk.tether.io/sdk/core-module/configuration) |
| API Reference | Complete class and type reference | [WDK Core API Reference](https://docs.wdk.tether.io/sdk/core-module/api-reference) |

## Examples

| Example | Description |
|---------|-------------|
| [Getting Started](https://github.com/tetherto/wdk-examples/blob/main/wdk/getting-started.ts) | Generate a seed phrase, validate it, and create a WDK instance |
| [Register Wallets](https://github.com/tetherto/wdk-examples/blob/main/wdk/register-wallets.ts) | Register Solana, TON, and TRON wallet managers in one WDK instance |
| [Manage Accounts](https://github.com/tetherto/wdk-examples/blob/main/wdk/manage-accounts.ts) | Retrieve accounts by index and path and inspect multi-chain balances |
| [Send Transactions](https://github.com/tetherto/wdk-examples/blob/main/wdk/send-transactions.ts) | Quote and optionally send native transactions across multiple chains |
| [Middleware](https://github.com/tetherto/wdk-examples/blob/main/wdk/middleware.ts) | Register middleware and inspect account access hooks |
| [Error Handling](https://github.com/tetherto/wdk-examples/blob/main/wdk/error-handling.ts) | Handle missing registrations and dispose selected wallets safely |

> For detailed walkthroughs, see the [Usage Guide](https://docs.wdk.tether.io/sdk/core-module/usage).
> See all runnable examples in the [wdk-examples](https://github.com/tetherto/wdk-examples) repository.

## Community

Join the [WDK Discord](https://discord.gg/arYXDhHB2w) to connect with other developers.

## Support

For support, please [open an issue](https://github.com/tetherto/wdk/issues) on GitHub or reach out via [email](mailto:wallet-info@tether.io).

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.
