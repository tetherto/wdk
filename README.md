# WDK Core

**WDK** is a simple tool that enables you to manage the WDK wallet and protocol modules through a single object.

### Modules Managed

**Wallet Modules** - Add wallet support for any blockchain:
- `@tetherto/wdk-wallet-evm` - Ethereum, Polygon, Arbitrum 
- `@tetherto/wdk-wallet-evm-erc4337` - EVM with no gas fees
- `@tetherto/wdk-wallet-ton` - TON blockchain
- `@tetherto/wdk-wallet-ton-gasless` - TON with no gas fees
- `@tetherto/wdk-wallet-btc` - Bitcoin
- `@tetherto/wdk-wallet-tron` - TRON blockchain
- `@tetherto/wdk-wallet-solana` - Solana blockchain

**Service Modules** - Add swap, bridge, and lending services:
- `@tetherto/wdk-protocol-swap-paraswap-evm` - Token swaps on EVM
- `@tetherto/wdk-protocol-bridge-usdt0-evm` - Bridge tokens between EVM chains
- `@tetherto/wdk-protocol-bridge-usdt0-ton` - Bridge tokens from TON to other chains
- `@tetherto/wdk-protocol-lending-aave-evm` - Lending and borrowing on EVM

**📚 Full module list and docs:** [docs.wallet.tether.io](https://docs.wallet.tether.io)

## Features

- **Module Manager**: Controls and connects all WDK wallet and service modules
- **Wallet Modules**: Works with `@tetherto/wdk-wallet-evm`, `@tetherto/wdk-wallet-evm-erc-4337`, `@tetherto/wdk-wallet-tron` and other wallet packages
- **Service Modules**: Manages `@tetherto/wdk-protocol-bridge-usdt0-evm`, `@tetherto/wdk-protocol-bridge-usdt0-ton` and other service packages
- **One Setup**: Add any WDK module when you need it for any blockchain
- **Simple Control**: Manage all your wallet and service modules in one place

## How to Install

```bash
npm install @tetherto/wdk
```

## Quick Start

```typescript
import WDK from '@tetherto/wdk'
import WalletManagerEvm from '@tetherto/wdk-wallet-evm'
import WalletManagerTon from '@tetherto/wdk-wallet-ton'
import ParaswapProtocolEvm from '@tetherto/wdk-protocol-swap-paraswap-evm'
import Usdt0ProtocolTon from '@tetherto/wdk-protocol-bridge-usdt0-ton'

// Set up WDK with wallets and services
const wdk = new WDK(seed) //seed are your twelve word phrase
  .registerWallet('ethereum', WalletManagerEvm, ethereumWalletConfig)
  .registerWallet('ton', WalletManagerTon, tonWalletConfig)
  .registerProtocol('ethereum', 'paraswap', ParaswapProtocolEvm, paraswapProtocolConfig)
  .registerProtocol('ton', 'usdt0', Usdt0ProtocolTon, usdt0ProtocolConfig)

// Get accounts using different ways
const ethAccount = await wdk.getAccount('ethereum', 3)
const tonAccount = await wdk.getAccountByPath('ton', "1'/2/3")

// Send transactions directly
const { hash: txHash, fee: txFee } = await ethAccount.sendTransaction(tx)

// Use swap service
const paraswap = ethAccount.getSwapProtocol('paraswap')
const { hash: swapHash, fee: swapFee } = await paraswap.swap(swapOptions)

// Use bridge service  
const usdt0 = tonAccount.getBridgeProtocol('usdt0')
const { hash: bridgeHash, fee: bridgeFee } = await usdt0.bridge(bridgeOptions)

// These will throw errors:
// const accountTron = await wdk.getAccount('tron', 5)  // no tron wallet added
// const badBridge = accountEth.getBridgeProtocol('usdt0')  // no usdt0 for ethereum
// const badSwap = tonAccount.getSwapProtocol('dedust')  // no dedust for ton
```

## How to Use

### WDK

#### Start
```typescript
constructor(seed: string | Uint8Array)
```

#### Add Things
- `registerWallet<W>(blockchain: string, wallet: W, config: WalletConfig): WDK`
- `registerProtocol<P>(blockchain: string, label: string, protocol: P, config: ProtocolConfig): WDK`
- `registerMiddleware(blockchain: string, middleware: MiddlewareFunction): WDK`
- `registerPolicies(policies: Array<Policy>): WDK`

#### Get Accounts
- `getAccount(blockchain: string, index?: number): Promise<IWalletAccountWithProtocols>`
- `getAccountByPath(blockchain: string, path: string): Promise<IWalletAccountWithProtocols>`
- `getFeeRates(blockchain: string): Promise<FeeRates>`

#### Other Tools
- `dispose(): void`

#### Helper Tools
- `getRandomSeedPhrase(): string`
- `isValidSeedPhrase(seedPhrase: string): boolean`

### Account with Services

Works with a basic wallet account but adds service management:

- `registerProtocol<P>(label: string, protocol: P, config: ProtocolConfig): IWalletAccountWithProtocols`
- `getSwapProtocol(label: string): ISwapProtocol` - Gets the swap service with the given name
- `getBridgeProtocol(label: string): IBridgeProtocol` - Gets the bridge service with the given name  
- `getLendingProtocol(label: string): ILendingProtocol` - Gets the lending service with the given name

## How to Use It

### Add Many Blockchains
```typescript
const wdk = new WDK(seed) //seed is your twelve word phrase
  .registerWallet('ethereum', WalletManagerEvm, ethereumWalletConfig)
  .registerWallet('arbitrum', WalletManagerEvm, arbitrumWalletConfig)
  .registerWallet('ton', WalletManagerTon, tonWalletConfig)
```

### Add Services to One Account
```typescript
const account = await wdk.getAccount('ethereum', 0)
account.registerProtocol('paraswap', ParaswapProtocolEvm, paraswapProtocolConfig)

const paraswap = account.getSwapProtocol('paraswap')
const { hash, fee } = await paraswap.swap(swapOptions)

// This will throw an error - no service with this name:
// const uniswap = account.getSwapProtocol('uniswap')
```

### Add Extra Tools to Accounts
```typescript
wdk.registerMiddleware('ethereum', async (account) => {
  console.log('New account:', await account.getAddress())
})
```

### Register Policies

```typescript
wdk.registerPolicies([
  {
    name: 'max-transfer-1eth',
    method: 'sendTransaction',
    evaluate({ method, params }) {
      if (method !== 'sendTransaction') return true
      return BigInt(params.value ?? 0) <= 10n ** 18n
    }
  }
])
```

### Wallet-Specific Policy

```typescript
wdk.registerPolicies([
  {
    name: 'ethereum-only-bridge',
    target: { blockchain: 'ethereum' },
    method: 'bridge',
    evaluate: () => false
  }
])
```

### Protocol-Targeted Policy

```typescript
wdk.registerPolicies([
  {
    name: 'swap-max-fee',
    target: {
      protocol: { blockchain: 'ethereum', label: 'paraswap' }
    },
    method: 'swap',
    evaluate: () => false
  }
])
```

### Multiple Methods

```typescript
wdk.registerPolicies([
  {
    name: 'disable-critical-ops',
    target: { blockchain: 'ethereum' },
    method: ['bridge', 'borrow', 'repay'],
    evaluate: () => false
  }
])
```

### Recipient Whitelist

```typescript
const allowed = new Set(['0xabc...', '0xdef...'])

wdk.registerPolicies([
  {
    name: 'recipient-whitelist',
    method: 'sendTransaction',
    evaluate({ params }) {
      if (!params?.to) return true
      return allowed.has(params.to.toLowerCase())
    }
  }
])
```

### Async Policy

```typescript
wdk.registerPolicies([
  {
    name: 'business-hours',
    async evaluate() {
      const hour = new Date().getUTCHours()
      return hour >= 8 && hour < 18
    }
  }
])
```

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For support, please open an issue on the GitHub repository.

## Learn More

For full docs, visit [docs.wallet.tether.io](https://docs.wallet.tether.io)
