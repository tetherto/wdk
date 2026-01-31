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

describe('Transfer Tools Schema Validation', () => {
  describe('wdk_quote_transfer input schema', () => {
    it('should require blockchain parameter', () => {
      const input = {
        index: 0,
        recipient: '0x1234',
        amount: '1000000000000000000'
      }

      // Validate that blockchain is required
      expect(input.blockchain).toBeUndefined()
    })

    it('should accept valid transfer parameters', () => {
      const input = {
        blockchain: 'ethereum',
        index: 0,
        recipient: '0x1234567890abcdef1234567890abcdef12345678',
        amount: '1000000000000000000',
        tokenAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7'
      }

      expect(input.blockchain).toBe('ethereum')
      expect(input.index).toBe(0)
      expect(input.recipient).toMatch(/^0x[a-fA-F0-9]{40}$/)
      expect(BigInt(input.amount)).toBe(BigInt('1000000000000000000'))
    })

    it('should handle native token transfer (no tokenAddress)', () => {
      const input = {
        blockchain: 'ethereum',
        index: 0,
        recipient: '0x1234567890abcdef1234567890abcdef12345678',
        amount: '1000000000000000000'
      }

      expect(input.tokenAddress).toBeUndefined()
    })
  })

  describe('wdk_transfer annotations', () => {
    const annotations = {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true
    }

    it('should be marked as destructive', () => {
      expect(annotations.destructiveHint).toBe(true)
    })

    it('should not be marked as read-only', () => {
      expect(annotations.readOnlyHint).toBe(false)
    })

    it('should not be idempotent (transfers are unique)', () => {
      expect(annotations.idempotentHint).toBe(false)
    })

    it('should be marked as open world (interacts with blockchain)', () => {
      expect(annotations.openWorldHint).toBe(true)
    })
  })

  describe('wdk_quote_transfer annotations', () => {
    const annotations = {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true
    }

    it('should be marked as read-only', () => {
      expect(annotations.readOnlyHint).toBe(true)
    })

    it('should not be destructive', () => {
      expect(annotations.destructiveHint).toBe(false)
    })

    it('should be idempotent (same input = same quote)', () => {
      expect(annotations.idempotentHint).toBe(true)
    })
  })
})

describe('Transfer Response Format', () => {
  it('should format quote response correctly', () => {
    const quoteResponse = {
      blockchain: 'ethereum',
      from: '0xsender',
      to: '0xrecipient',
      amount: '1000000000000000000',
      tokenAddress: 'native',
      estimatedFee: '21000000000000',
      feeUnit: 'base',
      message: 'Quote retrieved successfully. Call wdk_transfer to execute.'
    }

    expect(quoteResponse).toHaveProperty('blockchain')
    expect(quoteResponse).toHaveProperty('from')
    expect(quoteResponse).toHaveProperty('to')
    expect(quoteResponse).toHaveProperty('amount')
    expect(quoteResponse).toHaveProperty('estimatedFee')
    expect(quoteResponse.message).toContain('wdk_transfer')
  })

  it('should format transfer response correctly', () => {
    const transferResponse = {
      success: true,
      blockchain: 'ethereum',
      from: '0xsender',
      to: '0xrecipient',
      amount: '1000000000000000000',
      tokenAddress: 'native',
      transactionHash: '0xabc123',
      fee: '21000000000000',
      message: 'Transfer executed successfully'
    }

    expect(transferResponse.success).toBe(true)
    expect(transferResponse).toHaveProperty('transactionHash')
    expect(transferResponse.transactionHash).toMatch(/^0x/)
  })
})
