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
 * Registers fiat on/off-ramp protocol tools with the MCP server.
 *
 * @param {McpServer} server - The MCP server instance.
 * @param {WdkMcpServerState} state - The server state.
 */
export function registerFiatTools (server, state) {
  // Tool: Register a fiat protocol
  server.registerTool(
    'wdk_register_fiat_protocol',
    {
      description: 'Register a fiat on/off-ramp protocol for buying and selling crypto with fiat currency.',
      inputSchema: {
        blockchain: z.string().describe('The blockchain name'),
        protocolName: z.string().describe('The fiat protocol name'),
        config: z.object({}).passthrough().optional().describe('Optional protocol configuration (API keys, etc.)')
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

        // Note: Fiat protocol packages would need to be implemented
        // This is a placeholder for the pattern
        return textResponse('Fiat protocol registration not yet implemented. Please check WDK documentation for available fiat protocols.', true)
      } catch (error) {
        return textResponse(`Failed to register fiat protocol: ${error.message}`, true)
      }
    }
  )

  // Tool: Get supported crypto assets for fiat operations
  server.registerTool(
    'wdk_fiat_get_supported_assets',
    {
      description: 'Get a list of supported crypto assets for fiat buy/sell operations.',
      inputSchema: {
        blockchain: z.string().describe('The blockchain name'),
        index: z.number().int().min(0).default(0).describe('The account index (default: 0)'),
        protocolName: z.string().describe('The fiat protocol name')
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true
      }
    },
    async ({ blockchain, index = 0, protocolName }) => {
      try {
        if (!state.initialized || !state.wdk) {
          return textResponse('WDK not initialized. Call wdk_initialize first.', true)
        }

        const account = await state.wdk.getAccount(blockchain.toLowerCase(), index)
        const fiatProtocol = account.getFiatProtocol(protocolName.toLowerCase())

        const assets = await fiatProtocol.getSupportedCryptoAssets()

        return jsonResponse({
          blockchain: blockchain.toLowerCase(),
          protocol: protocolName.toLowerCase(),
          supportedAssets: assets
        })
      } catch (error) {
        return textResponse(`Failed to get supported assets: ${error.message}`, true)
      }
    }
  )

  // Tool: Get supported fiat currencies
  server.registerTool(
    'wdk_fiat_get_supported_currencies',
    {
      description: 'Get a list of supported fiat currencies for buy/sell operations.',
      inputSchema: {
        blockchain: z.string().describe('The blockchain name'),
        index: z.number().int().min(0).default(0).describe('The account index (default: 0)'),
        protocolName: z.string().describe('The fiat protocol name')
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true
      }
    },
    async ({ blockchain, index = 0, protocolName }) => {
      try {
        if (!state.initialized || !state.wdk) {
          return textResponse('WDK not initialized. Call wdk_initialize first.', true)
        }

        const account = await state.wdk.getAccount(blockchain.toLowerCase(), index)
        const fiatProtocol = account.getFiatProtocol(protocolName.toLowerCase())

        const currencies = await fiatProtocol.getSupportedFiatCurrencies()

        return jsonResponse({
          blockchain: blockchain.toLowerCase(),
          protocol: protocolName.toLowerCase(),
          supportedCurrencies: currencies
        })
      } catch (error) {
        return textResponse(`Failed to get supported currencies: ${error.message}`, true)
      }
    }
  )

  // Tool: Get supported countries
  server.registerTool(
    'wdk_fiat_get_supported_countries',
    {
      description: 'Get a list of supported countries for fiat operations.',
      inputSchema: {
        blockchain: z.string().describe('The blockchain name'),
        index: z.number().int().min(0).default(0).describe('The account index (default: 0)'),
        protocolName: z.string().describe('The fiat protocol name')
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true
      }
    },
    async ({ blockchain, index = 0, protocolName }) => {
      try {
        if (!state.initialized || !state.wdk) {
          return textResponse('WDK not initialized. Call wdk_initialize first.', true)
        }

        const account = await state.wdk.getAccount(blockchain.toLowerCase(), index)
        const fiatProtocol = account.getFiatProtocol(protocolName.toLowerCase())

        const countries = await fiatProtocol.getSupportedCountries()

        return jsonResponse({
          blockchain: blockchain.toLowerCase(),
          protocol: protocolName.toLowerCase(),
          supportedCountries: countries
        })
      } catch (error) {
        return textResponse(`Failed to get supported countries: ${error.message}`, true)
      }
    }
  )

  // Tool: Quote buy (fiat to crypto)
  server.registerTool(
    'wdk_fiat_quote_buy',
    {
      description: 'Get a quote for buying crypto with fiat currency. Returns the expected crypto amount and fees.',
      inputSchema: {
        blockchain: z.string().describe('The blockchain name'),
        index: z.number().int().min(0).default(0).describe('The account index (default: 0)'),
        protocolName: z.string().describe('The fiat protocol name'),
        cryptoAsset: z.string().describe('The crypto asset code (e.g., "usdt", "btc")'),
        fiatCurrency: z.string().describe('The fiat currency ISO code (e.g., "USD", "EUR")'),
        fiatAmount: z.string().optional().describe('Amount in fiat smallest unit (e.g., cents). Provide either fiatAmount OR cryptoAmount.'),
        cryptoAmount: z.string().optional().describe('Amount in crypto base unit. Provide either fiatAmount OR cryptoAmount.')
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true
      }
    },
    async ({ blockchain, index = 0, protocolName, cryptoAsset, fiatCurrency, fiatAmount, cryptoAmount }) => {
      try {
        if (!state.initialized || !state.wdk) {
          return textResponse('WDK not initialized. Call wdk_initialize first.', true)
        }

        if (!fiatAmount && !cryptoAmount) {
          return textResponse('Either fiatAmount or cryptoAmount must be provided.', true)
        }

        const account = await state.wdk.getAccount(blockchain.toLowerCase(), index)
        const fiatProtocol = account.getFiatProtocol(protocolName.toLowerCase())

        const quoteOptions = {
          cryptoAsset,
          fiatCurrency
        }

        if (fiatAmount) {
          quoteOptions.fiatAmount = BigInt(fiatAmount)
        } else {
          quoteOptions.cryptoAmount = BigInt(cryptoAmount)
        }

        const quote = await fiatProtocol.quoteBuy(quoteOptions)

        return jsonResponse({
          blockchain: blockchain.toLowerCase(),
          protocol: protocolName.toLowerCase(),
          operation: 'buy',
          cryptoAsset,
          fiatCurrency,
          cryptoAmount: quote.cryptoAmount.toString(),
          fiatAmount: quote.fiatAmount.toString(),
          fee: quote.fee.toString(),
          rate: quote.rate,
          message: 'Buy quote retrieved. Call wdk_fiat_buy to get the payment URL.'
        })
      } catch (error) {
        return textResponse(`Failed to quote buy: ${error.message}`, true)
      }
    }
  )

  // Tool: Buy crypto with fiat
  server.registerTool(
    'wdk_fiat_buy',
    {
      description: 'Generate a URL for buying crypto with fiat currency. The user must complete the purchase through the provided URL.',
      inputSchema: {
        blockchain: z.string().describe('The blockchain name'),
        index: z.number().int().min(0).default(0).describe('The account index (default: 0)'),
        protocolName: z.string().describe('The fiat protocol name'),
        cryptoAsset: z.string().describe('The crypto asset code'),
        fiatCurrency: z.string().describe('The fiat currency ISO code'),
        fiatAmount: z.string().optional().describe('Amount in fiat smallest unit'),
        cryptoAmount: z.string().optional().describe('Amount in crypto base unit'),
        recipient: z.string().optional().describe('Recipient address (defaults to account address)')
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async ({ blockchain, index = 0, protocolName, cryptoAsset, fiatCurrency, fiatAmount, cryptoAmount, recipient }) => {
      try {
        if (!state.initialized || !state.wdk) {
          return textResponse('WDK not initialized. Call wdk_initialize first.', true)
        }

        if (!fiatAmount && !cryptoAmount) {
          return textResponse('Either fiatAmount or cryptoAmount must be provided.', true)
        }

        const account = await state.wdk.getAccount(blockchain.toLowerCase(), index)
        const fiatProtocol = account.getFiatProtocol(protocolName.toLowerCase())

        const buyOptions = {
          cryptoAsset,
          fiatCurrency,
          recipient
        }

        if (fiatAmount) {
          buyOptions.fiatAmount = BigInt(fiatAmount)
        } else {
          buyOptions.cryptoAmount = BigInt(cryptoAmount)
        }

        const result = await fiatProtocol.buy(buyOptions)

        return jsonResponse({
          blockchain: blockchain.toLowerCase(),
          protocol: protocolName.toLowerCase(),
          operation: 'buy',
          buyUrl: result.buyUrl,
          message: 'Buy URL generated. Direct the user to complete the purchase at the provided URL.'
        })
      } catch (error) {
        return textResponse(`Failed to generate buy URL: ${error.message}`, true)
      }
    }
  )

  // Tool: Quote sell (crypto to fiat)
  server.registerTool(
    'wdk_fiat_quote_sell',
    {
      description: 'Get a quote for selling crypto for fiat currency. Returns the expected fiat amount and fees.',
      inputSchema: {
        blockchain: z.string().describe('The blockchain name'),
        index: z.number().int().min(0).default(0).describe('The account index (default: 0)'),
        protocolName: z.string().describe('The fiat protocol name'),
        cryptoAsset: z.string().describe('The crypto asset code'),
        fiatCurrency: z.string().describe('The fiat currency ISO code'),
        fiatAmount: z.string().optional().describe('Target fiat amount in smallest unit'),
        cryptoAmount: z.string().optional().describe('Crypto amount in base unit to sell')
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true
      }
    },
    async ({ blockchain, index = 0, protocolName, cryptoAsset, fiatCurrency, fiatAmount, cryptoAmount }) => {
      try {
        if (!state.initialized || !state.wdk) {
          return textResponse('WDK not initialized. Call wdk_initialize first.', true)
        }

        if (!fiatAmount && !cryptoAmount) {
          return textResponse('Either fiatAmount or cryptoAmount must be provided.', true)
        }

        const account = await state.wdk.getAccount(blockchain.toLowerCase(), index)
        const fiatProtocol = account.getFiatProtocol(protocolName.toLowerCase())

        const quoteOptions = {
          cryptoAsset,
          fiatCurrency
        }

        if (fiatAmount) {
          quoteOptions.fiatAmount = BigInt(fiatAmount)
        } else {
          quoteOptions.cryptoAmount = BigInt(cryptoAmount)
        }

        const quote = await fiatProtocol.quoteSell(quoteOptions)

        return jsonResponse({
          blockchain: blockchain.toLowerCase(),
          protocol: protocolName.toLowerCase(),
          operation: 'sell',
          cryptoAsset,
          fiatCurrency,
          cryptoAmount: quote.cryptoAmount.toString(),
          fiatAmount: quote.fiatAmount.toString(),
          fee: quote.fee.toString(),
          rate: quote.rate,
          message: 'Sell quote retrieved. Call wdk_fiat_sell to get the sell URL.'
        })
      } catch (error) {
        return textResponse(`Failed to quote sell: ${error.message}`, true)
      }
    }
  )

  // Tool: Sell crypto for fiat
  server.registerTool(
    'wdk_fiat_sell',
    {
      description: 'Generate a URL for selling crypto for fiat currency. The user must complete the sale through the provided URL.',
      inputSchema: {
        blockchain: z.string().describe('The blockchain name'),
        index: z.number().int().min(0).default(0).describe('The account index (default: 0)'),
        protocolName: z.string().describe('The fiat protocol name'),
        cryptoAsset: z.string().describe('The crypto asset code'),
        fiatCurrency: z.string().describe('The fiat currency ISO code'),
        fiatAmount: z.string().optional().describe('Target fiat amount'),
        cryptoAmount: z.string().optional().describe('Crypto amount to sell'),
        refundAddress: z.string().optional().describe('Address for refunds (defaults to account address)')
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async ({ blockchain, index = 0, protocolName, cryptoAsset, fiatCurrency, fiatAmount, cryptoAmount, refundAddress }) => {
      try {
        if (!state.initialized || !state.wdk) {
          return textResponse('WDK not initialized. Call wdk_initialize first.', true)
        }

        if (!fiatAmount && !cryptoAmount) {
          return textResponse('Either fiatAmount or cryptoAmount must be provided.', true)
        }

        const account = await state.wdk.getAccount(blockchain.toLowerCase(), index)
        const fiatProtocol = account.getFiatProtocol(protocolName.toLowerCase())

        const sellOptions = {
          cryptoAsset,
          fiatCurrency,
          refundAddress
        }

        if (fiatAmount) {
          sellOptions.fiatAmount = BigInt(fiatAmount)
        } else {
          sellOptions.cryptoAmount = BigInt(cryptoAmount)
        }

        const result = await fiatProtocol.sell(sellOptions)

        return jsonResponse({
          blockchain: blockchain.toLowerCase(),
          protocol: protocolName.toLowerCase(),
          operation: 'sell',
          sellUrl: result.sellUrl,
          message: 'Sell URL generated. Direct the user to complete the sale at the provided URL.'
        })
      } catch (error) {
        return textResponse(`Failed to generate sell URL: ${error.message}`, true)
      }
    }
  )

  // Tool: Get fiat transaction status
  server.registerTool(
    'wdk_fiat_get_transaction',
    {
      description: 'Get the status of a fiat buy/sell transaction.',
      inputSchema: {
        blockchain: z.string().describe('The blockchain name'),
        index: z.number().int().min(0).default(0).describe('The account index (default: 0)'),
        protocolName: z.string().describe('The fiat protocol name'),
        transactionId: z.string().describe('The fiat transaction ID')
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true
      }
    },
    async ({ blockchain, index = 0, protocolName, transactionId }) => {
      try {
        if (!state.initialized || !state.wdk) {
          return textResponse('WDK not initialized. Call wdk_initialize first.', true)
        }

        const account = await state.wdk.getAccount(blockchain.toLowerCase(), index)
        const fiatProtocol = account.getFiatProtocol(protocolName.toLowerCase())

        const txDetail = await fiatProtocol.getTransactionDetail(transactionId)

        return jsonResponse({
          blockchain: blockchain.toLowerCase(),
          protocol: protocolName.toLowerCase(),
          transactionId,
          status: txDetail.status,
          cryptoAsset: txDetail.cryptoAsset,
          fiatCurrency: txDetail.fiatCurrency
        })
      } catch (error) {
        return textResponse(`Failed to get transaction: ${error.message}`, true)
      }
    }
  )
}
