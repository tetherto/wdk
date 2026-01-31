# Agent Guide

This subdirectory contains the MCP (Model Context Protocol) server for the Tether WDK (Wallet Development Kit) ecosystem. It follows the same strict coding conventions as the parent WDK repositories, with additional MCP-specific patterns.

## Project Overview
- **Architecture:** MCP server exposing WDK functionality as tools for AI agents.
- **Runtime:** Node.js (>=18.0.0) with ES Modules.
- **Protocol:** Model Context Protocol (MCP) with stdio transport.

## Tech Stack & Tooling
- **Language:** JavaScript (ES2015+).
- **Module System:** ES Modules (`"type": "module"` in package.json).
- **Type Checking:** TypeScript is used purely for generating type declarations (`.d.ts`). The source code remains JavaScript.
  - Command: `npm run build:types`
- **Linting:** `standard` (JavaScript Standard Style).
  - Command: `npm run lint` / `npm run lint:fix`
- **Testing:** `jest` (configured with `experimental-vm-modules` for ESM support).
  - Command: `npm test`
- **MCP SDK:** `@modelcontextprotocol/sdk` for protocol implementation.
- **Schema Validation:** `zod` for input schema definitions.

## Coding Conventions

### Tether WDK Conventions (Inherited)
- **File Naming:** Kebab-case (e.g., `wallet-tools.js`).
- **Class Naming:** PascalCase (e.g., `WdkMcpServer`).
- **Private Members:** Prefixed with `_` (underscore) and explicitly documented with `@private`.
- **Imports:** Explicit file extensions are mandatory (e.g., `import ... from './file.js'`).
- **Copyright:** All source files must include the standard Tether copyright header.

### MCP-Specific Conventions
- **Tool Naming:** Action-oriented with `wdk_` prefix (e.g., `wdk_transfer`, `wdk_quote_swap`).
- **Quote-First Pattern:** For any operation that moves funds, always provide a `wdk_quote_*` tool before the execution tool.
- **Tool Annotations:** Use MCP annotations to indicate tool behavior:
  - `readOnlyHint: true` - Tool does not modify state
  - `destructiveHint: true` - Tool performs irreversible operations (transfers, swaps)
  - `idempotentHint: true` - Tool can be safely called multiple times
  - `openWorldHint: true` - Tool interacts with external systems
- **Logging:** NEVER use `console.log()` for stdio servers - it corrupts JSON-RPC. Use `console.error()` instead.
- **Responses:** Use consistent response helpers:
  - `textResponse(text, isError)` for text responses
  - `jsonResponse(data)` for structured JSON responses

## Documentation (JSDoc)
Source code must be strictly typed using JSDoc comments to support the `build:types` process.
- **Types:** Use `@typedef` to define or import types.
- **Methods:** Use `@param`, `@returns`, `@throws`.
- **Generics:** Use `@template`.

## Tool Categories

### Wallet Tools (`src/tools/wallet/`)
- `wdk_generate_seed` - Generate BIP-39 seed phrase
- `wdk_validate_seed` - Validate seed phrase
- `wdk_initialize` - Initialize WDK with seed
- `wdk_register_wallet` - Register blockchain wallet
- `wdk_get_account` - Get account at index
- `wdk_get_address` - Get wallet address
- `wdk_get_balance` - Get native token balance
- `wdk_get_token_balance` - Get ERC20/token balance
- `wdk_status` - Get server status

### Transfer Tools (`src/tools/transfer/`)
- `wdk_quote_transfer` - Quote a transfer (read-only)
- `wdk_transfer` - Execute a transfer (destructive)
- `wdk_send_transaction` - Send raw transaction (advanced)

### Swap Tools (`src/tools/swap/`)
- `wdk_register_swap_protocol` - Register swap protocol
- `wdk_quote_swap` - Quote a swap (read-only)
- `wdk_swap` - Execute a swap (destructive)

### Bridge Tools (`src/tools/bridge/`)
- `wdk_register_bridge_protocol` - Register bridge protocol
- `wdk_quote_bridge` - Quote a bridge (read-only)
- `wdk_bridge` - Execute a bridge (destructive)

### Lending Tools (`src/tools/lending/`)
- `wdk_register_lending_protocol` - Register lending protocol
- `wdk_quote_lending_supply` - Quote supply operation
- `wdk_lending_supply` - Supply to lending pool
- `wdk_quote_lending_withdraw` - Quote withdraw operation
- `wdk_lending_withdraw` - Withdraw from lending pool
- `wdk_quote_lending_borrow` - Quote borrow operation
- `wdk_lending_borrow` - Borrow from lending pool
- `wdk_quote_lending_repay` - Quote repay operation
- `wdk_lending_repay` - Repay borrowed tokens

### Fiat Tools (`src/tools/fiat/`)
- `wdk_register_fiat_protocol` - Register fiat on/off-ramp
- `wdk_fiat_get_supported_assets` - List supported crypto assets
- `wdk_fiat_get_supported_currencies` - List supported fiat currencies
- `wdk_fiat_get_supported_countries` - List supported countries
- `wdk_fiat_quote_buy` - Quote fiat-to-crypto purchase
- `wdk_fiat_buy` - Generate buy URL
- `wdk_fiat_quote_sell` - Quote crypto-to-fiat sale
- `wdk_fiat_sell` - Generate sell URL
- `wdk_fiat_get_transaction` - Get transaction status

## Development Workflow
1. **Install:** `npm install`
2. **Lint:** `npm run lint`
3. **Test:** `npm test`
4. **Build Types:** `npm run build:types`
5. **Run Server:** `npm start`
6. **Inspect Tools:** `npm run inspect` (opens MCP Inspector)

## Key Files
- `index.js`: Main entry point for programmatic use.
- `bin/wdk-mcp.js`: CLI entry point for npx/direct execution.
- `src/server.js`: MCP server implementation.
- `src/tools/`: Tool implementations organized by category.
- `types/`: Generated type definitions (do not edit manually).

## Adding New Tools

1. Create a new file in the appropriate `src/tools/{category}/` directory.
2. Follow the tool registration pattern:
```javascript
server.registerTool(
  'wdk_tool_name',
  {
    description: 'Clear description of what the tool does',
    inputSchema: {
      param: z.string().describe('Parameter description')
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true
    }
  },
  async ({ param }) => {
    // Implementation
    return jsonResponse({ result: 'data' })
  }
)
```

3. Export the registration function and import it in `src/server.js`.
4. Add JSDoc type definitions for any new types.
5. Run `npm run lint` and `npm run build:types`.

## Security Considerations
- Never log seed phrases or private keys.
- Always validate inputs before processing.
- Use the quote-first pattern for all fund-moving operations.
- Mark destructive tools with `destructiveHint: true`.
- Seed phrases should only come from environment variables, never hardcoded.
