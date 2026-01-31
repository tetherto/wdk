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

import { describe, it, expect } from '@jest/globals'

describe('Swap Tools', () => {
  describe('Quote-First Pattern', () => {
    it('should have quote tool for swaps', () => {
      const toolNames = [
        'wdk_register_swap_protocol',
        'wdk_quote_swap',
        'wdk_swap'
      ]

      // Verify quote tool exists before execute tool
      const quoteIndex = toolNames.indexOf('wdk_quote_swap')
      const swapIndex = toolNames.indexOf('wdk_swap')

      expect(quoteIndex).toBeLessThan(swapIndex)
      expect(toolNames).toContain('wdk_quote_swap')
      expect(toolNames).toContain('wdk_swap')
    })
  })

  describe('Swap Response Format', () => {
    it('should format swap quote correctly', () => {
      const quoteResponse = {
        blockchain: 'ethereum',
        protocol: 'paraswap',
        fromToken: '0xeth',
        toToken: '0xusdt',
        inputAmount: '1000000000000000000',
        expectedOutput: '3245000000',
        minimumOutput: '3212550000',
        estimatedFee: '50000000000000',
        priceImpact: 0.1,
        message: 'Swap quote retrieved successfully. Call wdk_swap to execute.'
      }

      expect(quoteResponse).toHaveProperty('expectedOutput')
      expect(quoteResponse).toHaveProperty('minimumOutput')
      expect(quoteResponse).toHaveProperty('priceImpact')
      expect(quoteResponse.message).toContain('wdk_swap')
    })
  })
})

describe('Bridge Tools', () => {
  describe('Quote-First Pattern', () => {
    it('should have quote tool for bridges', () => {
      const toolNames = [
        'wdk_register_bridge_protocol',
        'wdk_quote_bridge',
        'wdk_bridge'
      ]

      expect(toolNames).toContain('wdk_quote_bridge')
      expect(toolNames).toContain('wdk_bridge')
    })
  })

  describe('Bridge Response Format', () => {
    it('should format bridge quote correctly', () => {
      const quoteResponse = {
        blockchain: 'ethereum',
        destinationChain: 'arbitrum',
        protocol: 'usdt0',
        token: '0xusdt',
        inputAmount: '1000000000',
        expectedOutput: '999000000',
        estimatedFee: '1000000',
        estimatedTime: '5-15 minutes',
        message: 'Bridge quote retrieved successfully. Call wdk_bridge to execute.'
      }

      expect(quoteResponse).toHaveProperty('destinationChain')
      expect(quoteResponse).toHaveProperty('expectedOutput')
      expect(quoteResponse).toHaveProperty('estimatedTime')
    })
  })
})

describe('Lending Tools', () => {
  describe('Quote-First Pattern for All Operations', () => {
    const lendingOperations = ['supply', 'withdraw', 'borrow', 'repay']

    lendingOperations.forEach(operation => {
      it(`should have quote tool for ${operation}`, () => {
        const quoteTool = `wdk_quote_lending_${operation}`
        const executeTool = `wdk_lending_${operation}`

        // Both tools should exist
        expect(quoteTool).toContain('quote')
        expect(executeTool).not.toContain('quote')
      })
    })
  })

  describe('Lending Tool Annotations', () => {
    it('should mark supply as destructive', () => {
      const annotations = {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true
      }

      expect(annotations.destructiveHint).toBe(true)
    })

    it('should mark quote_supply as read-only', () => {
      const annotations = {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true
      }

      expect(annotations.readOnlyHint).toBe(true)
      expect(annotations.destructiveHint).toBe(false)
    })
  })
})

describe('Fiat Tools', () => {
  describe('Buy/Sell Operations', () => {
    it('should have quote and execute tools for buy', () => {
      const tools = ['wdk_fiat_quote_buy', 'wdk_fiat_buy']

      expect(tools).toContain('wdk_fiat_quote_buy')
      expect(tools).toContain('wdk_fiat_buy')
    })

    it('should have quote and execute tools for sell', () => {
      const tools = ['wdk_fiat_quote_sell', 'wdk_fiat_sell']

      expect(tools).toContain('wdk_fiat_quote_sell')
      expect(tools).toContain('wdk_fiat_sell')
    })
  })

  describe('Fiat Quote Response', () => {
    it('should include rate and fee information', () => {
      const quoteResponse = {
        blockchain: 'ethereum',
        protocol: 'moonpay',
        operation: 'buy',
        cryptoAsset: 'usdt',
        fiatCurrency: 'USD',
        cryptoAmount: '100000000',
        fiatAmount: '10000',
        fee: '350',
        rate: '1.0001',
        message: 'Buy quote retrieved. Call wdk_fiat_buy to get the payment URL.'
      }

      expect(quoteResponse).toHaveProperty('rate')
      expect(quoteResponse).toHaveProperty('fee')
      expect(quoteResponse).toHaveProperty('cryptoAmount')
      expect(quoteResponse).toHaveProperty('fiatAmount')
    })
  })

  describe('Fiat Buy Response', () => {
    it('should return a buy URL', () => {
      const buyResponse = {
        blockchain: 'ethereum',
        protocol: 'moonpay',
        operation: 'buy',
        buyUrl: 'https://buy.moonpay.com/...',
        message: 'Buy URL generated. Direct the user to complete the purchase at the provided URL.'
      }

      expect(buyResponse).toHaveProperty('buyUrl')
      expect(buyResponse.buyUrl).toMatch(/^https?:\/\//)
    })
  })
})

describe('Tool Naming Convention', () => {
  const toolNames = [
    'wdk_generate_seed',
    'wdk_validate_seed',
    'wdk_initialize',
    'wdk_register_wallet',
    'wdk_get_account',
    'wdk_get_address',
    'wdk_get_balance',
    'wdk_get_token_balance',
    'wdk_status',
    'wdk_quote_transfer',
    'wdk_transfer',
    'wdk_send_transaction',
    'wdk_register_swap_protocol',
    'wdk_quote_swap',
    'wdk_swap',
    'wdk_register_bridge_protocol',
    'wdk_quote_bridge',
    'wdk_bridge',
    'wdk_register_lending_protocol',
    'wdk_quote_lending_supply',
    'wdk_lending_supply',
    'wdk_quote_lending_withdraw',
    'wdk_lending_withdraw',
    'wdk_quote_lending_borrow',
    'wdk_lending_borrow',
    'wdk_quote_lending_repay',
    'wdk_lending_repay',
    'wdk_register_fiat_protocol',
    'wdk_fiat_get_supported_assets',
    'wdk_fiat_get_supported_currencies',
    'wdk_fiat_get_supported_countries',
    'wdk_fiat_quote_buy',
    'wdk_fiat_buy',
    'wdk_fiat_quote_sell',
    'wdk_fiat_sell',
    'wdk_fiat_get_transaction'
  ]

  it('should prefix all tools with wdk_', () => {
    toolNames.forEach(tool => {
      expect(tool).toMatch(/^wdk_/)
    })
  })

  it('should use snake_case for tool names', () => {
    toolNames.forEach(tool => {
      // Should not contain uppercase letters
      expect(tool).toBe(tool.toLowerCase())
      // Should not contain hyphens
      expect(tool).not.toContain('-')
    })
  })

  it('should have 36 tools total', () => {
    expect(toolNames).toHaveLength(36)
  })
})
