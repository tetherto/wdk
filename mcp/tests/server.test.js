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

import { describe, it, expect, beforeEach } from '@jest/globals'
import WdkMcpServer from '../src/server.js'

describe('WdkMcpServer', () => {
  let server

  beforeEach(() => {
    server = new WdkMcpServer()
  })

  describe('constructor', () => {
    it('should create server with default config', () => {
      expect(server).toBeInstanceOf(WdkMcpServer)
    })

    it('should create server with custom config', () => {
      const config = { seedPhrase: 'test seed phrase' }
      const customServer = new WdkMcpServer(config)
      expect(customServer).toBeInstanceOf(WdkMcpServer)
    })

    it('should initialize state correctly', () => {
      const state = server.getState()
      expect(state.initialized).toBe(false)
      expect(state.wdk).toBe(null)
      expect(state.registeredWallets).toBeInstanceOf(Set)
      expect(state.registeredWallets.size).toBe(0)
      expect(state.registeredProtocols).toBeInstanceOf(Map)
      expect(state.registeredProtocols.size).toBe(0)
    })
  })

  describe('getServer', () => {
    it('should return the MCP server instance', () => {
      const mcpServer = server.getServer()
      expect(mcpServer).toBeDefined()
      // McpServer stores name internally, verify it's an McpServer by checking for connect method
      expect(typeof mcpServer.connect).toBe('function')
    })
  })

  describe('getState', () => {
    it('should return the current state', () => {
      const state = server.getState()
      expect(state).toHaveProperty('initialized')
      expect(state).toHaveProperty('wdk')
      expect(state).toHaveProperty('registeredWallets')
      expect(state).toHaveProperty('registeredProtocols')
    })
  })
})
