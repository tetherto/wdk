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

import { z } from 'zod'

/**
 * @typedef {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} McpServer
 * @typedef {import('../../server.js').WdkMcpServerState} WdkMcpServerState
 */

/**
 * Creates a text content response for MCP tools.
 *
 * @param {string} text - The response text.
 * @param {boolean} [isError=false] - Whether this is an error response.
 * @returns {{ content: Array<{ type: 'text', text: string }>, isError?: boolean }}
 */
function textResponse (text, isError = false) {
  /** @type {{ content: Array<{ type: 'text', text: string }>, isError?: boolean }} */
  const response = {
    content: [{ type: /** @type {const} */ ('text'), text }]
  }
  if (isError) {
    response.isError = true
  }
  return response
}

/**
 * Creates a JSON content response for MCP tools.
 *
 * @param {Object} data - The data to serialize.
 * @returns {{ content: Array<{ type: 'text', text: string }> }}
 */
function jsonResponse (data) {
  return {
    content: [{ type: /** @type {const} */ ('text'), text: JSON.stringify(data, null, 2) }]
  }
}

/**
 * Registers lending protocol tools with the MCP server.
 *
 * @param {McpServer} server - The MCP server instance.
 * @param {WdkMcpServerState} state - The server state.
 */
export function registerLendingTools (server, state) {
  // Tool: Register a lending protocol
  server.registerTool(
    'wdk_register_lending_protocol',
    {
      description: 'Register a lending protocol for DeFi operations (supply, borrow, withdraw, repay). Requires the appropriate @tetherto/wdk-protocol-lending-* package.',
      inputSchema: {
        blockchain: z.string().describe('The blockchain name (e.g., "ethereum", "arbitrum")'),
        protocolName: z.string().describe('The protocol name (e.g., "aave")'),
        config: z.object({}).passthrough().optional().describe('Optional protocol configuration')
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true
      }
    },
    async ({ blockchain, protocolName, config: protocolConfig }) => {
      try {
        if (!state.initialized || !state.wdk) {
          return textResponse('WDK not initialized. Call wdk_initialize first.', true)
        }

        if (!state.registeredWallets.has(blockchain.toLowerCase())) {
          return textResponse(`Wallet not registered for ${blockchain}. Call wdk_register_wallet first.`, true)
        }

        const protocolPackageMap = {
          aave: '@tetherto/wdk-protocol-lending-aave-evm'
        }

        const packageName = protocolPackageMap[protocolName.toLowerCase()]
        if (!packageName) {
          return textResponse(`Unknown lending protocol: ${protocolName}. Supported: ${Object.keys(protocolPackageMap).join(', ')}`, true)
        }

        let Protocol
        try {
          const module = await import(packageName)
          Protocol = module.default || module
        } catch (importError) {
          return textResponse(`Protocol package ${packageName} not installed. Run: npm install ${packageName}`, true)
        }

        state.wdk.registerProtocol(blockchain.toLowerCase(), protocolName.toLowerCase(), Protocol, protocolConfig || {})

        if (!state.registeredProtocols.has(blockchain.toLowerCase())) {
          state.registeredProtocols.set(blockchain.toLowerCase(), new Set())
        }
        state.registeredProtocols.get(blockchain.toLowerCase()).add(`lending:${protocolName.toLowerCase()}`)

        return jsonResponse({
          success: true,
          blockchain: blockchain.toLowerCase(),
          protocol: protocolName.toLowerCase(),
          type: 'lending',
          message: `Lending protocol ${protocolName} registered for ${blockchain}`
        })
      } catch (error) {
        return textResponse(`Failed to register lending protocol: ${error.message}`, true)
      }
    }
  )

  // Tool: Quote supply operation
  server.registerTool(
    'wdk_quote_lending_supply',
    {
      description: 'Get a quote for supplying tokens to a lending pool. This is a read-only operation.',
      inputSchema: {
        blockchain: z.string().describe('The blockchain name'),
        index: z.number().int().min(0).default(0).describe('The account index (default: 0)'),
        protocolName: z.string().describe('The lending protocol name (e.g., "aave")'),
        token: z.string().describe('The token address to supply'),
        amount: z.string().describe('The amount to supply in base units')
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true
      }
    },
    async ({ blockchain, index = 0, protocolName, token, amount }) => {
      try {
        if (!state.initialized || !state.wdk) {
          return textResponse('WDK not initialized. Call wdk_initialize first.', true)
        }

        const account = await state.wdk.getAccount(blockchain.toLowerCase(), index)
        const lendingProtocol = account.getLendingProtocol(protocolName.toLowerCase())

        const quote = await lendingProtocol.quoteSupply({
          token,
          amount: BigInt(amount)
        })

        return jsonResponse({
          blockchain: blockchain.toLowerCase(),
          protocol: protocolName.toLowerCase(),
          operation: 'supply',
          token,
          amount,
          estimatedFee: quote.fee.toString(),
          message: 'Supply quote retrieved. Call wdk_lending_supply to execute.'
        })
      } catch (error) {
        return textResponse(`Failed to quote supply: ${error.message}`, true)
      }
    }
  )

  // Tool: Supply tokens to lending pool
  server.registerTool(
    'wdk_lending_supply',
    {
      description: 'Supply tokens to a lending pool to earn interest. WARNING: This locks your tokens in the protocol.',
      inputSchema: {
        blockchain: z.string().describe('The blockchain name'),
        index: z.number().int().min(0).default(0).describe('The account index (default: 0)'),
        protocolName: z.string().describe('The lending protocol name (e.g., "aave")'),
        token: z.string().describe('The token address to supply'),
        amount: z.string().describe('The amount to supply in base units'),
        onBehalfOf: z.string().optional().describe('Address to supply on behalf of (defaults to self)')
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async ({ blockchain, index = 0, protocolName, token, amount, onBehalfOf }) => {
      try {
        if (!state.initialized || !state.wdk) {
          return textResponse('WDK not initialized. Call wdk_initialize first.', true)
        }

        const account = await state.wdk.getAccount(blockchain.toLowerCase(), index)
        const lendingProtocol = account.getLendingProtocol(protocolName.toLowerCase())

        const result = await lendingProtocol.supply({
          token,
          amount: BigInt(amount),
          onBehalfOf
        })

        return jsonResponse({
          success: true,
          blockchain: blockchain.toLowerCase(),
          protocol: protocolName.toLowerCase(),
          operation: 'supply',
          token,
          amount,
          transactionHash: result.hash,
          fee: result.fee.toString(),
          message: 'Tokens supplied to lending pool successfully'
        })
      } catch (error) {
        return textResponse(`Failed to supply: ${error.message}`, true)
      }
    }
  )

  // Tool: Quote withdraw operation
  server.registerTool(
    'wdk_quote_lending_withdraw',
    {
      description: 'Get a quote for withdrawing tokens from a lending pool. This is a read-only operation.',
      inputSchema: {
        blockchain: z.string().describe('The blockchain name'),
        index: z.number().int().min(0).default(0).describe('The account index (default: 0)'),
        protocolName: z.string().describe('The lending protocol name'),
        token: z.string().describe('The token address to withdraw'),
        amount: z.string().describe('The amount to withdraw in base units')
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true
      }
    },
    async ({ blockchain, index = 0, protocolName, token, amount }) => {
      try {
        if (!state.initialized || !state.wdk) {
          return textResponse('WDK not initialized. Call wdk_initialize first.', true)
        }

        const account = await state.wdk.getAccount(blockchain.toLowerCase(), index)
        const lendingProtocol = account.getLendingProtocol(protocolName.toLowerCase())

        const quote = await lendingProtocol.quoteWithdraw({
          token,
          amount: BigInt(amount)
        })

        return jsonResponse({
          blockchain: blockchain.toLowerCase(),
          protocol: protocolName.toLowerCase(),
          operation: 'withdraw',
          token,
          amount,
          estimatedFee: quote.fee.toString(),
          message: 'Withdraw quote retrieved. Call wdk_lending_withdraw to execute.'
        })
      } catch (error) {
        return textResponse(`Failed to quote withdraw: ${error.message}`, true)
      }
    }
  )

  // Tool: Withdraw tokens from lending pool
  server.registerTool(
    'wdk_lending_withdraw',
    {
      description: 'Withdraw tokens from a lending pool.',
      inputSchema: {
        blockchain: z.string().describe('The blockchain name'),
        index: z.number().int().min(0).default(0).describe('The account index (default: 0)'),
        protocolName: z.string().describe('The lending protocol name'),
        token: z.string().describe('The token address to withdraw'),
        amount: z.string().describe('The amount to withdraw in base units'),
        to: z.string().optional().describe('Address to receive withdrawn tokens (defaults to self)')
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async ({ blockchain, index = 0, protocolName, token, amount, to }) => {
      try {
        if (!state.initialized || !state.wdk) {
          return textResponse('WDK not initialized. Call wdk_initialize first.', true)
        }

        const account = await state.wdk.getAccount(blockchain.toLowerCase(), index)
        const lendingProtocol = account.getLendingProtocol(protocolName.toLowerCase())

        const result = await lendingProtocol.withdraw({
          token,
          amount: BigInt(amount),
          to
        })

        return jsonResponse({
          success: true,
          blockchain: blockchain.toLowerCase(),
          protocol: protocolName.toLowerCase(),
          operation: 'withdraw',
          token,
          amount,
          transactionHash: result.hash,
          fee: result.fee.toString(),
          message: 'Tokens withdrawn from lending pool successfully'
        })
      } catch (error) {
        return textResponse(`Failed to withdraw: ${error.message}`, true)
      }
    }
  )

  // Tool: Quote borrow operation
  server.registerTool(
    'wdk_quote_lending_borrow',
    {
      description: 'Get a quote for borrowing tokens from a lending pool. Requires collateral to be supplied first.',
      inputSchema: {
        blockchain: z.string().describe('The blockchain name'),
        index: z.number().int().min(0).default(0).describe('The account index (default: 0)'),
        protocolName: z.string().describe('The lending protocol name'),
        token: z.string().describe('The token address to borrow'),
        amount: z.string().describe('The amount to borrow in base units')
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true
      }
    },
    async ({ blockchain, index = 0, protocolName, token, amount }) => {
      try {
        if (!state.initialized || !state.wdk) {
          return textResponse('WDK not initialized. Call wdk_initialize first.', true)
        }

        const account = await state.wdk.getAccount(blockchain.toLowerCase(), index)
        const lendingProtocol = account.getLendingProtocol(protocolName.toLowerCase())

        const quote = await lendingProtocol.quoteBorrow({
          token,
          amount: BigInt(amount)
        })

        return jsonResponse({
          blockchain: blockchain.toLowerCase(),
          protocol: protocolName.toLowerCase(),
          operation: 'borrow',
          token,
          amount,
          estimatedFee: quote.fee.toString(),
          message: 'Borrow quote retrieved. Call wdk_lending_borrow to execute.'
        })
      } catch (error) {
        return textResponse(`Failed to quote borrow: ${error.message}`, true)
      }
    }
  )

  // Tool: Borrow tokens
  server.registerTool(
    'wdk_lending_borrow',
    {
      description: 'Borrow tokens from a lending pool. WARNING: This creates a debt position. Ensure you have sufficient collateral.',
      inputSchema: {
        blockchain: z.string().describe('The blockchain name'),
        index: z.number().int().min(0).default(0).describe('The account index (default: 0)'),
        protocolName: z.string().describe('The lending protocol name'),
        token: z.string().describe('The token address to borrow'),
        amount: z.string().describe('The amount to borrow in base units'),
        onBehalfOf: z.string().optional().describe('Address to borrow on behalf of (defaults to self)')
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async ({ blockchain, index = 0, protocolName, token, amount, onBehalfOf }) => {
      try {
        if (!state.initialized || !state.wdk) {
          return textResponse('WDK not initialized. Call wdk_initialize first.', true)
        }

        const account = await state.wdk.getAccount(blockchain.toLowerCase(), index)
        const lendingProtocol = account.getLendingProtocol(protocolName.toLowerCase())

        const result = await lendingProtocol.borrow({
          token,
          amount: BigInt(amount),
          onBehalfOf
        })

        return jsonResponse({
          success: true,
          blockchain: blockchain.toLowerCase(),
          protocol: protocolName.toLowerCase(),
          operation: 'borrow',
          token,
          amount,
          transactionHash: result.hash,
          fee: result.fee.toString(),
          message: 'Tokens borrowed successfully. Remember to repay your debt.'
        })
      } catch (error) {
        return textResponse(`Failed to borrow: ${error.message}`, true)
      }
    }
  )

  // Tool: Quote repay operation
  server.registerTool(
    'wdk_quote_lending_repay',
    {
      description: 'Get a quote for repaying borrowed tokens to a lending pool.',
      inputSchema: {
        blockchain: z.string().describe('The blockchain name'),
        index: z.number().int().min(0).default(0).describe('The account index (default: 0)'),
        protocolName: z.string().describe('The lending protocol name'),
        token: z.string().describe('The token address to repay'),
        amount: z.string().describe('The amount to repay in base units')
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true
      }
    },
    async ({ blockchain, index = 0, protocolName, token, amount }) => {
      try {
        if (!state.initialized || !state.wdk) {
          return textResponse('WDK not initialized. Call wdk_initialize first.', true)
        }

        const account = await state.wdk.getAccount(blockchain.toLowerCase(), index)
        const lendingProtocol = account.getLendingProtocol(protocolName.toLowerCase())

        const quote = await lendingProtocol.quoteRepay({
          token,
          amount: BigInt(amount)
        })

        return jsonResponse({
          blockchain: blockchain.toLowerCase(),
          protocol: protocolName.toLowerCase(),
          operation: 'repay',
          token,
          amount,
          estimatedFee: quote.fee.toString(),
          message: 'Repay quote retrieved. Call wdk_lending_repay to execute.'
        })
      } catch (error) {
        return textResponse(`Failed to quote repay: ${error.message}`, true)
      }
    }
  )

  // Tool: Repay borrowed tokens
  server.registerTool(
    'wdk_lending_repay',
    {
      description: 'Repay borrowed tokens to a lending pool to reduce debt position.',
      inputSchema: {
        blockchain: z.string().describe('The blockchain name'),
        index: z.number().int().min(0).default(0).describe('The account index (default: 0)'),
        protocolName: z.string().describe('The lending protocol name'),
        token: z.string().describe('The token address to repay'),
        amount: z.string().describe('The amount to repay in base units'),
        onBehalfOf: z.string().optional().describe('Address to repay on behalf of (defaults to self)')
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async ({ blockchain, index = 0, protocolName, token, amount, onBehalfOf }) => {
      try {
        if (!state.initialized || !state.wdk) {
          return textResponse('WDK not initialized. Call wdk_initialize first.', true)
        }

        const account = await state.wdk.getAccount(blockchain.toLowerCase(), index)
        const lendingProtocol = account.getLendingProtocol(protocolName.toLowerCase())

        const result = await lendingProtocol.repay({
          token,
          amount: BigInt(amount),
          onBehalfOf
        })

        return jsonResponse({
          success: true,
          blockchain: blockchain.toLowerCase(),
          protocol: protocolName.toLowerCase(),
          operation: 'repay',
          token,
          amount,
          transactionHash: result.hash,
          fee: result.fee.toString(),
          message: 'Debt repaid successfully'
        })
      } catch (error) {
        return textResponse(`Failed to repay: ${error.message}`, true)
      }
    }
  )
}
