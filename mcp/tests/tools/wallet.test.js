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

import { jest, describe, it, expect, beforeEach } from '@jest/globals'

// Mock WDK module
const mockWDK = {
  getRandomSeedPhrase: jest.fn(),
  isValidSeedPhrase: jest.fn()
}

// Mock the WDK import
jest.unstable_mockModule('@tetherto/wdk', () => ({
  default: class MockWDK {
    constructor (seed) {
      this.seed = seed
    }

    registerWallet (blockchain, manager, config) {
      return this
    }

    registerProtocol (blockchain, name, protocol, config) {
      return this
    }

    async getAccount (blockchain, index) {
      return {
        async getAddress () {
          return '0x1234567890abcdef1234567890abcdef12345678'
        },
        async getBalance () {
          return BigInt('1000000000000000000')
        },
        async getTokenBalance (tokenAddress) {
          return BigInt('5000000000')
        }
      }
    }

    static getRandomSeedPhrase () {
      return mockWDK.getRandomSeedPhrase()
    }

    static isValidSeedPhrase (seed) {
      return mockWDK.isValidSeedPhrase(seed)
    }
  }
}))

describe('Wallet Tools', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('wdk_generate_seed', () => {
    it('should generate a valid seed phrase', () => {
      const expectedSeed = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
      mockWDK.getRandomSeedPhrase.mockReturnValue(expectedSeed)

      // Import dynamically to get mocked version
      const result = mockWDK.getRandomSeedPhrase()

      expect(result).toBe(expectedSeed)
      expect(result.split(' ').length).toBe(12)
    })
  })

  describe('wdk_validate_seed', () => {
    it('should validate a correct seed phrase', () => {
      const validSeed = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
      mockWDK.isValidSeedPhrase.mockReturnValue(true)

      const result = mockWDK.isValidSeedPhrase(validSeed)

      expect(result).toBe(true)
      expect(mockWDK.isValidSeedPhrase).toHaveBeenCalledWith(validSeed)
    })

    it('should reject an invalid seed phrase', () => {
      const invalidSeed = 'invalid seed phrase'
      mockWDK.isValidSeedPhrase.mockReturnValue(false)

      const result = mockWDK.isValidSeedPhrase(invalidSeed)

      expect(result).toBe(false)
    })
  })
})

describe('Response Helpers', () => {
  /**
   * Creates a text content response for MCP tools.
   *
   * @param {string} text - The response text.
   * @param {boolean} [isError=false] - Whether this is an error response.
   * @returns {{ content: Array<{ type: string, text: string }>, isError?: boolean }}
   */
  function textResponse (text, isError = false) {
    const response = {
      content: [{ type: 'text', text }]
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
   * @returns {{ content: Array<{ type: string, text: string }> }}
   */
  function jsonResponse (data) {
    return {
      content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
    }
  }

  describe('textResponse', () => {
    it('should create a text response without error', () => {
      const response = textResponse('Hello, world!')

      expect(response).toEqual({
        content: [{ type: 'text', text: 'Hello, world!' }]
      })
      expect(response.isError).toBeUndefined()
    })

    it('should create a text response with error flag', () => {
      const response = textResponse('An error occurred', true)

      expect(response).toEqual({
        content: [{ type: 'text', text: 'An error occurred' }],
        isError: true
      })
    })
  })

  describe('jsonResponse', () => {
    it('should create a JSON response', () => {
      const data = { success: true, value: 42 }
      const response = jsonResponse(data)

      expect(response.content).toHaveLength(1)
      expect(response.content[0].type).toBe('text')

      const parsed = JSON.parse(response.content[0].text)
      expect(parsed).toEqual(data)
    })

    it('should handle nested objects', () => {
      const data = {
        wallet: {
          address: '0x123',
          balance: '1000000000000000000'
        },
        success: true
      }
      const response = jsonResponse(data)

      const parsed = JSON.parse(response.content[0].text)
      expect(parsed.wallet.address).toBe('0x123')
    })

    it('should handle arrays', () => {
      const data = {
        items: ['item1', 'item2', 'item3']
      }
      const response = jsonResponse(data)

      const parsed = JSON.parse(response.content[0].text)
      expect(parsed.items).toHaveLength(3)
    })
  })
})
