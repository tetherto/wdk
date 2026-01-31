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
 * Registers bridge protocol tools with the MCP server.
 *
 * @param {McpServer} server - The MCP server instance.
 * @param {WdkMcpServerState} state - The server state.
 */
export function registerBridgeTools (server, state) {
  // Tool: Register a bridge protocol
  server.registerTool(
    'wdk_register_bridge_protocol',
    {
      description: 'Register a bridge protocol for cross-chain transfers. Requires the appropriate @tetherto/wdk-protocol-bridge-* package to be installed.',
      inputSchema: {
        blockchain: z.string().describe('The source blockchain name (e.g., "ethereum", "ton")'),
        protocolName: z.string().describe('The protocol name (e.g., "usdt0")'),
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
          'usdt0-evm': '@tetherto/wdk-protocol-bridge-usdt0-evm',
          'usdt0-ton': '@tetherto/wdk-protocol-bridge-usdt0-ton',
          usdt0: blockchain.toLowerCase() === 'ton'
            ? '@tetherto/wdk-protocol-bridge-usdt0-ton'
            : '@tetherto/wdk-protocol-bridge-usdt0-evm'
        }

        const packageName = protocolPackageMap[protocolName.toLowerCase()]
        if (!packageName) {
          return textResponse(`Unknown bridge protocol: ${protocolName}. Supported: ${Object.keys(protocolPackageMap).join(', ')}`, true)
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
        state.registeredProtocols.get(blockchain.toLowerCase()).add(`bridge:${protocolName.toLowerCase()}`)

        return jsonResponse({
          success: true,
          blockchain: blockchain.toLowerCase(),
          protocol: protocolName.toLowerCase(),
          type: 'bridge',
          message: `Bridge protocol ${protocolName} registered for ${blockchain}`
        })
      } catch (error) {
        return textResponse(`Failed to register bridge protocol: ${error.message}`, true)
      }
    }
  )

  // Tool: Quote a bridge transfer
  server.registerTool(
    'wdk_quote_bridge',
    {
      description: 'Get a quote for a cross-chain bridge transfer. IMPORTANT: Always quote before executing to see fees and expected output. This is a read-only operation.',
      inputSchema: {
        blockchain: z.string().describe('The source blockchain name'),
        index: z.number().int().min(0).default(0).describe('The account index (default: 0)'),
        protocolName: z.string().describe('The bridge protocol name (e.g., "usdt0")'),
        destinationChain: z.string().describe('The destination blockchain name'),
        token: z.string().describe('The token address to bridge'),
        amount: z.string().describe('The amount to bridge in base units'),
        destinationAddress: z.string().optional().describe('The recipient address on destination chain (defaults to same account)')
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true
      }
    },
    async ({ blockchain, index = 0, protocolName, destinationChain, token, amount, destinationAddress }) => {
      try {
        if (!state.initialized || !state.wdk) {
          return textResponse('WDK not initialized. Call wdk_initialize first.', true)
        }

        const account = await state.wdk.getAccount(blockchain.toLowerCase(), index)
        const bridgeProtocol = account.getBridgeProtocol(protocolName.toLowerCase())

        const quote = await bridgeProtocol.quoteBridge({
          destinationChain: destinationChain.toLowerCase(),
          token,
          amount: BigInt(amount),
          destinationAddress
        })

        return jsonResponse({
          blockchain: blockchain.toLowerCase(),
          destinationChain: destinationChain.toLowerCase(),
          protocol: protocolName.toLowerCase(),
          token,
          inputAmount: amount,
          expectedOutput: quote.expectedOutput.toString(),
          estimatedFee: quote.fee.toString(),
          estimatedTime: quote.estimatedTime,
          message: 'Bridge quote retrieved successfully. Call wdk_bridge to execute.'
        })
      } catch (error) {
        return textResponse(`Failed to quote bridge: ${error.message}`, true)
      }
    }
  )

  // Tool: Execute a bridge transfer
  server.registerTool(
    'wdk_bridge',
    {
      description: 'Execute a cross-chain bridge transfer. WARNING: This is an irreversible operation. Always call wdk_quote_bridge first.',
      inputSchema: {
        blockchain: z.string().describe('The source blockchain name'),
        index: z.number().int().min(0).default(0).describe('The account index (default: 0)'),
        protocolName: z.string().describe('The bridge protocol name (e.g., "usdt0")'),
        destinationChain: z.string().describe('The destination blockchain name'),
        token: z.string().describe('The token address to bridge'),
        amount: z.string().describe('The amount to bridge in base units'),
        destinationAddress: z.string().optional().describe('The recipient address on destination chain (defaults to same account)')
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async ({ blockchain, index = 0, protocolName, destinationChain, token, amount, destinationAddress }) => {
      try {
        if (!state.initialized || !state.wdk) {
          return textResponse('WDK not initialized. Call wdk_initialize first.', true)
        }

        const account = await state.wdk.getAccount(blockchain.toLowerCase(), index)
        const bridgeProtocol = account.getBridgeProtocol(protocolName.toLowerCase())

        const result = await bridgeProtocol.bridge({
          destinationChain: destinationChain.toLowerCase(),
          token,
          amount: BigInt(amount),
          destinationAddress
        })

        return jsonResponse({
          success: true,
          blockchain: blockchain.toLowerCase(),
          destinationChain: destinationChain.toLowerCase(),
          protocol: protocolName.toLowerCase(),
          token,
          inputAmount: amount,
          transactionHash: result.hash,
          fee: result.fee.toString(),
          message: 'Bridge transfer initiated successfully. Funds will arrive on destination chain shortly.'
        })
      } catch (error) {
        return textResponse(`Failed to execute bridge: ${error.message}`, true)
      }
    }
  )
}
