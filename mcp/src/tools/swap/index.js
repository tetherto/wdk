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
 * Registers swap protocol tools with the MCP server.
 *
 * @param {McpServer} server - The MCP server instance.
 * @param {WdkMcpServerState} state - The server state.
 */
export function registerSwapTools (server, state) {
  // Tool: Register a swap protocol
  server.registerTool(
    'wdk_register_swap_protocol',
    {
      description: 'Register a swap protocol for a blockchain. This enables token swapping functionality. Requires the appropriate @tetherto/wdk-protocol-swap-* package to be installed.',
      inputSchema: {
        blockchain: z.string().describe('The blockchain name (e.g., "ethereum")'),
        protocolName: z.string().describe('The protocol name (e.g., "paraswap")'),
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

        // Dynamically import the protocol
        const protocolPackageMap = {
          paraswap: '@tetherto/wdk-protocol-swap-paraswap-evm'
        }

        const packageName = protocolPackageMap[protocolName.toLowerCase()]
        if (!packageName) {
          return textResponse(`Unknown swap protocol: ${protocolName}. Supported: ${Object.keys(protocolPackageMap).join(', ')}`, true)
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
        state.registeredProtocols.get(blockchain.toLowerCase()).add(`swap:${protocolName.toLowerCase()}`)

        return jsonResponse({
          success: true,
          blockchain: blockchain.toLowerCase(),
          protocol: protocolName.toLowerCase(),
          type: 'swap',
          message: `Swap protocol ${protocolName} registered for ${blockchain}`
        })
      } catch (error) {
        return textResponse(`Failed to register swap protocol: ${error.message}`, true)
      }
    }
  )

  // Tool: Quote a swap
  server.registerTool(
    'wdk_quote_swap',
    {
      description: 'Get a quote for a token swap. IMPORTANT: Always quote before executing a swap to see the expected output and fees. This is a read-only operation.',
      inputSchema: {
        blockchain: z.string().describe('The blockchain name'),
        index: z.number().int().min(0).default(0).describe('The account index (default: 0)'),
        protocolName: z.string().describe('The swap protocol name (e.g., "paraswap")'),
        fromToken: z.string().describe('The token address to swap from'),
        toToken: z.string().describe('The token address to swap to'),
        amount: z.string().describe('The amount to swap in base units'),
        slippage: z.number().min(0).max(100).default(1).describe('Slippage tolerance percentage (default: 1%)')
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true
      }
    },
    async ({ blockchain, index = 0, protocolName, fromToken, toToken, amount, slippage = 1 }) => {
      try {
        if (!state.initialized || !state.wdk) {
          return textResponse('WDK not initialized. Call wdk_initialize first.', true)
        }

        const account = await state.wdk.getAccount(blockchain.toLowerCase(), index)
        const swapProtocol = account.getSwapProtocol(protocolName.toLowerCase())

        const quote = await swapProtocol.quoteSwap({
          fromToken,
          toToken,
          amount: BigInt(amount),
          slippage
        })

        return jsonResponse({
          blockchain: blockchain.toLowerCase(),
          protocol: protocolName.toLowerCase(),
          fromToken,
          toToken,
          inputAmount: amount,
          expectedOutput: quote.expectedOutput.toString(),
          minimumOutput: quote.minimumOutput.toString(),
          estimatedFee: quote.fee.toString(),
          priceImpact: quote.priceImpact,
          message: 'Swap quote retrieved successfully. Call wdk_swap to execute.'
        })
      } catch (error) {
        return textResponse(`Failed to quote swap: ${error.message}`, true)
      }
    }
  )

  // Tool: Execute a swap
  server.registerTool(
    'wdk_swap',
    {
      description: 'Execute a token swap. WARNING: This is an irreversible operation. Always call wdk_quote_swap first to verify the expected output and fees.',
      inputSchema: {
        blockchain: z.string().describe('The blockchain name'),
        index: z.number().int().min(0).default(0).describe('The account index (default: 0)'),
        protocolName: z.string().describe('The swap protocol name (e.g., "paraswap")'),
        fromToken: z.string().describe('The token address to swap from'),
        toToken: z.string().describe('The token address to swap to'),
        amount: z.string().describe('The amount to swap in base units'),
        slippage: z.number().min(0).max(100).default(1).describe('Slippage tolerance percentage (default: 1%)')
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async ({ blockchain, index = 0, protocolName, fromToken, toToken, amount, slippage = 1 }) => {
      try {
        if (!state.initialized || !state.wdk) {
          return textResponse('WDK not initialized. Call wdk_initialize first.', true)
        }

        const account = await state.wdk.getAccount(blockchain.toLowerCase(), index)
        const swapProtocol = account.getSwapProtocol(protocolName.toLowerCase())

        const result = await swapProtocol.swap({
          fromToken,
          toToken,
          amount: BigInt(amount),
          slippage
        })

        return jsonResponse({
          success: true,
          blockchain: blockchain.toLowerCase(),
          protocol: protocolName.toLowerCase(),
          fromToken,
          toToken,
          inputAmount: amount,
          transactionHash: result.hash,
          fee: result.fee.toString(),
          message: 'Swap executed successfully'
        })
      } catch (error) {
        return textResponse(`Failed to execute swap: ${error.message}`, true)
      }
    }
  )
}
