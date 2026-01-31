# WDK MCP Server

**MCP (Model Context Protocol) server for the Tether Wallet Development Kit (WDK).**

Enables AI agents (Claude, GPT, Gemini, and others) to interact with multi-chain self-custodial wallets through a standardized protocol.

## Features

- **Multi-Chain Support:** Bitcoin, Ethereum, Arbitrum, Polygon, TON, Solana, TRON, and more
- **Wallet Operations:** Generate seeds, create accounts, check balances, transfer tokens
- **DeFi Protocols:** Swap, bridge, and lending operations
- **Fiat On/Off-Ramp:** Buy and sell crypto with fiat currency
- **Quote-First Pattern:** Always preview fees before executing transactions
- **Self-Custodial:** Your keys, your crypto - no third-party custody

## Installation

```bash
npm install @tetherto/wdk-mcp
```

## Quick Start

### With Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "wdk": {
      "command": "npx",
      "args": ["@tetherto/wdk-mcp"],
      "env": {
        "WDK_SEED_PHRASE": "your twelve word seed phrase here"
      }
    }
  }
}
```

### With Claude Code

```bash
# Add to your project's MCP configuration
claude mcp add wdk -- npx @tetherto/wdk-mcp
```

### Programmatic Usage

```javascript
import WdkMcpServer from '@tetherto/wdk-mcp'

const server = new WdkMcpServer({
  seedPhrase: process.env.WDK_SEED_PHRASE
})

await server.start()
```

## Available Tools

### Wallet Management
| Tool | Description |
|------|-------------|
| `wdk_generate_seed` | Generate a new BIP-39 seed phrase |
| `wdk_validate_seed` | Validate a seed phrase |
| `wdk_initialize` | Initialize WDK with a seed phrase |
| `wdk_register_wallet` | Register a wallet for a blockchain |
| `wdk_get_account` | Get an account at a specific index |
| `wdk_get_address` | Get the wallet address |
| `wdk_get_balance` | Get native token balance |
| `wdk_get_token_balance` | Get ERC20/token balance |
| `wdk_status` | Get server status |

### Transfers
| Tool | Description |
|------|-------------|
| `wdk_quote_transfer` | Get a quote for a transfer |
| `wdk_transfer` | Execute a transfer |
| `wdk_send_transaction` | Send a raw transaction |

### Swaps
| Tool | Description |
|------|-------------|
| `wdk_register_swap_protocol` | Register a swap protocol |
| `wdk_quote_swap` | Get a quote for a swap |
| `wdk_swap` | Execute a swap |

### Bridges
| Tool | Description |
|------|-------------|
| `wdk_register_bridge_protocol` | Register a bridge protocol |
| `wdk_quote_bridge` | Get a quote for a bridge |
| `wdk_bridge` | Execute a bridge |

### Lending
| Tool | Description |
|------|-------------|
| `wdk_register_lending_protocol` | Register a lending protocol |
| `wdk_quote_lending_supply` | Quote supply operation |
| `wdk_lending_supply` | Supply to lending pool |
| `wdk_quote_lending_withdraw` | Quote withdraw operation |
| `wdk_lending_withdraw` | Withdraw from pool |
| `wdk_quote_lending_borrow` | Quote borrow operation |
| `wdk_lending_borrow` | Borrow from pool |
| `wdk_quote_lending_repay` | Quote repay operation |
| `wdk_lending_repay` | Repay borrowed tokens |

### Fiat On/Off-Ramp
| Tool | Description |
|------|-------------|
| `wdk_fiat_quote_buy` | Quote fiat-to-crypto purchase |
| `wdk_fiat_buy` | Generate buy URL |
| `wdk_fiat_quote_sell` | Quote crypto-to-fiat sale |
| `wdk_fiat_sell` | Generate sell URL |

## Example Usage

### Initialize and Check Balance

```
User: Check my Ethereum balance

Claude: I'll initialize the wallet and check your balance.

[Calls wdk_initialize]
[Calls wdk_register_wallet with blockchain="ethereum"]
[Calls wdk_get_balance with blockchain="ethereum", index=0]

Your Ethereum wallet at 0x1234...5678 has a balance of 1.5 ETH.
```

### Transfer Tokens

```
User: Send 100 USDT to 0xRecipient on Ethereum

Claude: I'll quote the transfer first, then execute it.

[Calls wdk_quote_transfer]
Transfer quote:
- Amount: 100 USDT
- Estimated fee: 0.002 ETH
- Recipient: 0xRecipient

Shall I proceed with the transfer?

User: Yes

[Calls wdk_transfer]
Transfer successful! Transaction hash: 0xabc...123
```

### Swap Tokens

```
User: Swap 1 ETH for USDT on Ethereum

Claude: I'll quote the swap first.

[Calls wdk_quote_swap]
Swap quote:
- Input: 1 ETH
- Expected output: 3,245 USDT
- Slippage: 1%
- Price impact: 0.1%

Would you like to proceed?

User: Yes

[Calls wdk_swap]
Swap executed! Transaction hash: 0xdef...456
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `WDK_SEED_PHRASE` | BIP-39 seed phrase for wallet initialization |

## Required Peer Dependencies

Install the wallet packages for the blockchains you want to support:

```bash
# EVM chains (Ethereum, Arbitrum, Polygon, etc.)
npm install @tetherto/wdk-wallet-evm

# Bitcoin
npm install @tetherto/wdk-wallet-btc

# TON
npm install @tetherto/wdk-wallet-ton

# Solana
npm install @tetherto/wdk-wallet-solana

# TRON
npm install @tetherto/wdk-wallet-tron
```

Install protocol packages for DeFi operations:

```bash
# Swap (Paraswap)
npm install @tetherto/wdk-protocol-swap-paraswap-evm

# Bridge (USDT0)
npm install @tetherto/wdk-protocol-bridge-usdt0-evm
npm install @tetherto/wdk-protocol-bridge-usdt0-ton

# Lending (Aave)
npm install @tetherto/wdk-protocol-lending-aave-evm
```

## Development

```bash
# Install dependencies
npm install

# Run linter
npm run lint

# Run tests
npm test

# Build type declarations
npm run build:types

# Start server
npm start

# Test with MCP Inspector
npm run inspect
```

## Security

- **Never share your seed phrase** - anyone with access can control your wallet
- **Use environment variables** for seed phrases, never hardcode them
- **Review quotes** before executing transactions
- **Start with testnet** for development and testing

## License

Apache License 2.0 - see [LICENSE](../LICENSE)

## Support

- Documentation: [docs.wallet.tether.io](https://docs.wallet.tether.io)
- Issues: [github.com/tetherto/wdk-core/issues](https://github.com/tetherto/wdk-core/issues)

## Contributing

Contributions are welcome! Please read the [AGENTS.md](./AGENTS.md) guide for coding conventions.
