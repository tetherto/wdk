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
- **Protocol Registration Support**: Attach swap, bridge, lending, and fiat protocols to registered blockchains
- **Middleware Hooks**: Intercept account derivation with custom middleware
- **Transaction Policies**: Local policy engine that intercepts write-facing operations and enforces user-defined ALLOW/DENY rules across project, wallet, and account scopes — with simulation, nested-call handling, and structured `PolicyViolationError`s
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
      conditions: [({ params }) => BigInt(params.value) <= 10n ** 18n]
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

Policies have three scopes — `project` (all wallets), `wallet` (one chain), and `account` (specific derivation paths) — evaluated narrowest-first with `DENY` winning across scopes. Account-scope `ALLOW` rules can opt into `override_broader_scope: true` to short-circuit broader policies for explicit exceptions (e.g., treasury wallets). Conditions can be sync or async and may carry user-owned state via closures. Templates (`@tetherto/wdk-policy-templates`) and a portal UI for editing policies are coming in later phases.

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
