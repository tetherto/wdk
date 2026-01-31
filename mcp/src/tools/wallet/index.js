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
import WDK from '@tetherto/wdk'

/**
 * @typedef {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} McpServer
 * @typedef {import('../../server.js').WdkMcpServerState} WdkMcpServerState
 * @typedef {import('../../server.js').WdkMcpServerConfig} WdkMcpServerConfig
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
 * Registers wallet management tools with the MCP server.
 *
 * @param {McpServer} server - The MCP server instance.
 * @param {WdkMcpServerState} state - The server state.
 * @param {WdkMcpServerConfig} config - The server configuration.
 */
export function registerWalletTools (server, state, config) {
  // Tool: Generate a new random seed phrase
  server.registerTool(
    'wdk_generate_seed',
    {
      description: 'Generate a new random BIP-39 seed phrase for wallet creation. Returns a 12-word mnemonic that can be used to initialize a wallet. IMPORTANT: The seed phrase should be stored securely and never shared.',
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false
      }
    },
    async () => {
      try {
        const seedPhrase = WDK.getRandomSeedPhrase()
        return jsonResponse({
          seedPhrase,
          wordCount: seedPhrase.split(' ').length,
          warning: 'Store this seed phrase securely. Anyone with access to it can control the wallet.'
        })
      } catch (error) {
        return textResponse(`Failed to generate seed phrase: ${error.message}`, true)
      }
    }
  )

  // Tool: Validate a seed phrase
  server.registerTool(
    'wdk_validate_seed',
    {
      description: 'Validate a BIP-39 seed phrase. Returns whether the seed phrase is valid.',
      inputSchema: {
        seedPhrase: z.string().describe('The seed phrase to validate (12 or 24 words)')
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true
      }
    },
    async ({ seedPhrase }) => {
      try {
        const isValid = WDK.isValidSeedPhrase(seedPhrase)
        return jsonResponse({
          isValid,
          wordCount: seedPhrase.split(' ').length
        })
      } catch (error) {
        return textResponse(`Failed to validate seed phrase: ${error.message}`, true)
      }
    }
  )

  // Tool: Initialize WDK with a seed phrase
  server.registerTool(
    'wdk_initialize',
    {
      description: 'Initialize the WDK wallet manager with a seed phrase. This must be called before using any wallet operations. The seed phrase can be provided directly or via the WDK_SEED_PHRASE environment variable.',
      inputSchema: {
        seedPhrase: z.string().optional().describe('The seed phrase to use. If not provided, uses WDK_SEED_PHRASE environment variable.')
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true
      }
    },
    async ({ seedPhrase }) => {
      try {
        const seed = seedPhrase || config.seedPhrase || process.env.WDK_SEED_PHRASE

        if (!seed) {
          return textResponse('No seed phrase provided. Either pass seedPhrase parameter or set WDK_SEED_PHRASE environment variable.', true)
        }

        if (!WDK.isValidSeedPhrase(seed)) {
          return textResponse('Invalid seed phrase provided.', true)
        }

        // Initialize WDK
        state.wdk = new WDK(seed)
        state.initialized = true

        return jsonResponse({
          success: true,
          message: 'WDK initialized successfully',
          registeredWallets: Array.from(state.registeredWallets),
          registeredProtocols: Object.fromEntries(
            Array.from(state.registeredProtocols.entries()).map(
              ([k, v]) => [k, Array.from(v)]
            )
          )
        })
      } catch (error) {
        return textResponse(`Failed to initialize WDK: ${error.message}`, true)
      }
    }
  )

  // Tool: Register a wallet for a blockchain
  server.registerTool(
    'wdk_register_wallet',
    {
      description: 'Register a wallet manager for a specific blockchain. Supported blockchains depend on installed @tetherto/wdk-wallet-* packages.',
      inputSchema: {
        blockchain: z.string().describe('The blockchain name (e.g., "ethereum", "bitcoin", "ton", "solana", "tron", "arbitrum", "polygon")'),
        config: z.object({}).passthrough().optional().describe('Optional wallet configuration object')
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true
      }
    },
    async ({ blockchain, config: walletConfig }) => {
      try {
        if (!state.initialized || !state.wdk) {
          return textResponse('WDK not initialized. Call wdk_initialize first.', true)
        }

        // Dynamically import the wallet manager based on blockchain
        const walletPackageMap = {
          ethereum: '@tetherto/wdk-wallet-evm',
          arbitrum: '@tetherto/wdk-wallet-evm',
          polygon: '@tetherto/wdk-wallet-evm',
          optimism: '@tetherto/wdk-wallet-evm',
          base: '@tetherto/wdk-wallet-evm',
          bitcoin: '@tetherto/wdk-wallet-btc',
          ton: '@tetherto/wdk-wallet-ton',
          solana: '@tetherto/wdk-wallet-solana',
          tron: '@tetherto/wdk-wallet-tron'
        }

        const packageName = walletPackageMap[blockchain.toLowerCase()]
        if (!packageName) {
          return textResponse(`Unknown blockchain: ${blockchain}. Supported: ${Object.keys(walletPackageMap).join(', ')}`, true)
        }

        let WalletManager
        try {
          const module = await import(packageName)
          WalletManager = module.default || module.WalletManager
        } catch (importError) {
          return textResponse(`Wallet package ${packageName} not installed. Run: npm install ${packageName}`, true)
        }

        state.wdk.registerWallet(blockchain.toLowerCase(), WalletManager, walletConfig || {})
        state.registeredWallets.add(blockchain.toLowerCase())

        return jsonResponse({
          success: true,
          blockchain: blockchain.toLowerCase(),
          message: `Wallet registered for ${blockchain}`,
          registeredWallets: Array.from(state.registeredWallets)
        })
      } catch (error) {
        return textResponse(`Failed to register wallet: ${error.message}`, true)
      }
    }
  )

  // Tool: Get an account for a blockchain
  server.registerTool(
    'wdk_get_account',
    {
      description: 'Get a wallet account for a specific blockchain at a given index. The account can be used for transfers, swaps, bridges, and other operations.',
      inputSchema: {
        blockchain: z.string().describe('The blockchain name (e.g., "ethereum", "bitcoin")'),
        index: z.number().int().min(0).default(0).describe('The account index (default: 0)')
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true
      }
    },
    async ({ blockchain, index = 0 }) => {
      try {
        if (!state.initialized || !state.wdk) {
          return textResponse('WDK not initialized. Call wdk_initialize first.', true)
        }

        if (!state.registeredWallets.has(blockchain.toLowerCase())) {
          return textResponse(`Wallet not registered for ${blockchain}. Call wdk_register_wallet first.`, true)
        }

        const account = await state.wdk.getAccount(blockchain.toLowerCase(), index)
        const address = await account.getAddress()

        return jsonResponse({
          blockchain: blockchain.toLowerCase(),
          index,
          address,
          message: `Account retrieved successfully for ${blockchain} at index ${index}`
        })
      } catch (error) {
        return textResponse(`Failed to get account: ${error.message}`, true)
      }
    }
  )

  // Tool: Get address for an account
  server.registerTool(
    'wdk_get_address',
    {
      description: 'Get the wallet address for a specific blockchain account.',
      inputSchema: {
        blockchain: z.string().describe('The blockchain name'),
        index: z.number().int().min(0).default(0).describe('The account index (default: 0)')
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true
      }
    },
    async ({ blockchain, index = 0 }) => {
      try {
        if (!state.initialized || !state.wdk) {
          return textResponse('WDK not initialized. Call wdk_initialize first.', true)
        }

        if (!state.registeredWallets.has(blockchain.toLowerCase())) {
          return textResponse(`Wallet not registered for ${blockchain}. Call wdk_register_wallet first.`, true)
        }

        const account = await state.wdk.getAccount(blockchain.toLowerCase(), index)
        const address = await account.getAddress()

        return jsonResponse({
          blockchain: blockchain.toLowerCase(),
          index,
          address
        })
      } catch (error) {
        return textResponse(`Failed to get address: ${error.message}`, true)
      }
    }
  )

  // Tool: Get native balance
  server.registerTool(
    'wdk_get_balance',
    {
      description: 'Get the native token balance for a wallet account (e.g., ETH for Ethereum, BTC for Bitcoin, SOL for Solana).',
      inputSchema: {
        blockchain: z.string().describe('The blockchain name'),
        index: z.number().int().min(0).default(0).describe('The account index (default: 0)')
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true
      }
    },
    async ({ blockchain, index = 0 }) => {
      try {
        if (!state.initialized || !state.wdk) {
          return textResponse('WDK not initialized. Call wdk_initialize first.', true)
        }

        if (!state.registeredWallets.has(blockchain.toLowerCase())) {
          return textResponse(`Wallet not registered for ${blockchain}. Call wdk_register_wallet first.`, true)
        }

        const account = await state.wdk.getAccount(blockchain.toLowerCase(), index)
        const address = await account.getAddress()
        const balance = await account.getBalance()

        return jsonResponse({
          blockchain: blockchain.toLowerCase(),
          index,
          address,
          balance: balance.toString(),
          unit: 'wei' // Base unit - formatting should be done by the caller
        })
      } catch (error) {
        return textResponse(`Failed to get balance: ${error.message}`, true)
      }
    }
  )

  // Tool: Get token balance
  server.registerTool(
    'wdk_get_token_balance',
    {
      description: 'Get the balance of a specific token (e.g., USDT, USDC) for a wallet account.',
      inputSchema: {
        blockchain: z.string().describe('The blockchain name'),
        index: z.number().int().min(0).default(0).describe('The account index (default: 0)'),
        tokenAddress: z.string().describe('The token contract address')
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true
      }
    },
    async ({ blockchain, index = 0, tokenAddress }) => {
      try {
        if (!state.initialized || !state.wdk) {
          return textResponse('WDK not initialized. Call wdk_initialize first.', true)
        }

        if (!state.registeredWallets.has(blockchain.toLowerCase())) {
          return textResponse(`Wallet not registered for ${blockchain}. Call wdk_register_wallet first.`, true)
        }

        const account = await state.wdk.getAccount(blockchain.toLowerCase(), index)
        const address = await account.getAddress()
        const balance = await account.getTokenBalance(tokenAddress)

        return jsonResponse({
          blockchain: blockchain.toLowerCase(),
          index,
          address,
          tokenAddress,
          balance: balance.toString(),
          unit: 'base' // Base unit - formatting should be done by the caller
        })
      } catch (error) {
        return textResponse(`Failed to get token balance: ${error.message}`, true)
      }
    }
  )

  // Tool: Get server status
  server.registerTool(
    'wdk_status',
    {
      description: 'Get the current status of the WDK MCP server, including initialization state and registered wallets/protocols.',
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true
      }
    },
    async () => {
      return jsonResponse({
        initialized: state.initialized,
        registeredWallets: Array.from(state.registeredWallets),
        registeredProtocols: Object.fromEntries(
          Array.from(state.registeredProtocols.entries()).map(
            ([k, v]) => [k, Array.from(v)]
          )
        ),
        supportedBlockchains: [
          'ethereum',
          'arbitrum',
          'polygon',
          'optimism',
          'base',
          'bitcoin',
          'ton',
          'solana',
          'tron'
        ]
      })
    }
  )
}
