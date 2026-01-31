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
 * Registers transfer tools with the MCP server.
 *
 * @param {McpServer} server - The MCP server instance.
 * @param {WdkMcpServerState} state - The server state.
 */
export function registerTransferTools (server, state) {
  // Tool: Quote a transfer (always quote before executing)
  server.registerTool(
    'wdk_quote_transfer',
    {
      description: 'Get a quote for a token transfer. IMPORTANT: Always quote before executing a transfer to see the estimated fees. This is a read-only operation that does not execute the transfer.',
      inputSchema: {
        blockchain: z.string().describe('The blockchain name (e.g., "ethereum", "bitcoin")'),
        index: z.number().int().min(0).default(0).describe('The account index (default: 0)'),
        recipient: z.string().describe('The recipient wallet address'),
        amount: z.string().describe('The amount to transfer in base units (e.g., wei for ETH, satoshi for BTC)'),
        tokenAddress: z.string().optional().describe('The token contract address. If omitted, transfers native token (ETH, BTC, etc.)')
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true
      }
    },
    async ({ blockchain, index = 0, recipient, amount, tokenAddress }) => {
      try {
        if (!state.initialized || !state.wdk) {
          return textResponse('WDK not initialized. Call wdk_initialize first.', true)
        }

        if (!state.registeredWallets.has(blockchain.toLowerCase())) {
          return textResponse(`Wallet not registered for ${blockchain}. Call wdk_register_wallet first.`, true)
        }

        const account = await state.wdk.getAccount(blockchain.toLowerCase(), index)
        const fromAddress = await account.getAddress()

        const transferOptions = {
          recipient,
          amount: BigInt(amount)
        }

        if (tokenAddress) {
          transferOptions.token = tokenAddress
        }

        const quote = await account.quoteTransfer(transferOptions)

        return jsonResponse({
          blockchain: blockchain.toLowerCase(),
          from: fromAddress,
          to: recipient,
          amount,
          tokenAddress: tokenAddress || 'native',
          estimatedFee: quote.fee.toString(),
          feeUnit: 'base',
          message: 'Quote retrieved successfully. Call wdk_transfer to execute.'
        })
      } catch (error) {
        return textResponse(`Failed to quote transfer: ${error.message}`, true)
      }
    }
  )

  // Tool: Execute a transfer
  server.registerTool(
    'wdk_transfer',
    {
      description: 'Execute a token transfer. WARNING: This is an irreversible operation that sends real funds. Always call wdk_quote_transfer first to verify the fees.',
      inputSchema: {
        blockchain: z.string().describe('The blockchain name (e.g., "ethereum", "bitcoin")'),
        index: z.number().int().min(0).default(0).describe('The account index (default: 0)'),
        recipient: z.string().describe('The recipient wallet address'),
        amount: z.string().describe('The amount to transfer in base units (e.g., wei for ETH, satoshi for BTC)'),
        tokenAddress: z.string().optional().describe('The token contract address. If omitted, transfers native token (ETH, BTC, etc.)')
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async ({ blockchain, index = 0, recipient, amount, tokenAddress }) => {
      try {
        if (!state.initialized || !state.wdk) {
          return textResponse('WDK not initialized. Call wdk_initialize first.', true)
        }

        if (!state.registeredWallets.has(blockchain.toLowerCase())) {
          return textResponse(`Wallet not registered for ${blockchain}. Call wdk_register_wallet first.`, true)
        }

        const account = await state.wdk.getAccount(blockchain.toLowerCase(), index)
        const fromAddress = await account.getAddress()

        const transferOptions = {
          recipient,
          amount: BigInt(amount)
        }

        if (tokenAddress) {
          transferOptions.token = tokenAddress
        }

        const result = await account.transfer(transferOptions)

        return jsonResponse({
          success: true,
          blockchain: blockchain.toLowerCase(),
          from: fromAddress,
          to: recipient,
          amount,
          tokenAddress: tokenAddress || 'native',
          transactionHash: result.hash,
          fee: result.fee.toString(),
          message: 'Transfer executed successfully'
        })
      } catch (error) {
        return textResponse(`Failed to execute transfer: ${error.message}`, true)
      }
    }
  )

  // Tool: Send raw transaction
  server.registerTool(
    'wdk_send_transaction',
    {
      description: 'Send a raw transaction. WARNING: This is an advanced operation for custom transactions. Use wdk_transfer for standard transfers.',
      inputSchema: {
        blockchain: z.string().describe('The blockchain name'),
        index: z.number().int().min(0).default(0).describe('The account index (default: 0)'),
        transaction: z.object({}).passthrough().describe('The transaction object (blockchain-specific format)')
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async ({ blockchain, index = 0, transaction }) => {
      try {
        if (!state.initialized || !state.wdk) {
          return textResponse('WDK not initialized. Call wdk_initialize first.', true)
        }

        if (!state.registeredWallets.has(blockchain.toLowerCase())) {
          return textResponse(`Wallet not registered for ${blockchain}. Call wdk_register_wallet first.`, true)
        }

        const account = await state.wdk.getAccount(blockchain.toLowerCase(), index)
        const fromAddress = await account.getAddress()

        const result = await account.sendTransaction(transaction)

        return jsonResponse({
          success: true,
          blockchain: blockchain.toLowerCase(),
          from: fromAddress,
          transactionHash: result.hash,
          fee: result.fee.toString(),
          message: 'Transaction sent successfully'
        })
      } catch (error) {
        return textResponse(`Failed to send transaction: ${error.message}`, true)
      }
    }
  )
}
