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

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import { registerWalletTools } from './tools/wallet/index.js'
import { registerTransferTools } from './tools/transfer/index.js'
import { registerSwapTools } from './tools/swap/index.js'
import { registerBridgeTools } from './tools/bridge/index.js'
import { registerLendingTools } from './tools/lending/index.js'
import { registerFiatTools } from './tools/fiat/index.js'

/**
 * @typedef {import('@tetherto/wdk').default} WDK
 */

/**
 * @typedef {Object} WdkMcpServerConfig
 * @property {string} [seedPhrase] - Seed phrase for wallet initialization (from env: WDK_SEED_PHRASE).
 * @property {Object.<string, Object>} [wallets] - Wallet configurations keyed by blockchain name.
 * @property {Object.<string, Object.<string, Object>>} [protocols] - Protocol configurations keyed by blockchain and protocol name.
 */

/**
 * @typedef {Object} WdkMcpServerState
 * @property {WDK | null} wdk - The WDK instance.
 * @property {boolean} initialized - Whether the server has been initialized with a seed.
 * @property {Set<string>} registeredWallets - Set of registered wallet blockchain names.
 * @property {Map<string, Set<string>>} registeredProtocols - Map of blockchain to registered protocol names.
 */

/**
 * WDK MCP Server - Enables AI agents to interact with multi-chain wallets.
 *
 * @class
 */
export default class WdkMcpServer {
  /**
   * Creates a new WDK MCP Server instance.
   *
   * @param {WdkMcpServerConfig} [config={}] - Server configuration.
   */
  constructor (config = {}) {
    /**
     * Server configuration.
     *
     * @private
     * @type {WdkMcpServerConfig}
     */
    this._config = config

    /**
     * MCP server instance.
     *
     * @private
     * @type {McpServer}
     */
    this._server = new McpServer({
      name: 'wdk-mcp',
      version: '1.0.0-beta.1'
    }, {
      capabilities: {
        tools: {}
      }
    })

    /**
     * Server state.
     *
     * @private
     * @type {WdkMcpServerState}
     */
    this._state = {
      wdk: null,
      initialized: false,
      registeredWallets: new Set(),
      registeredProtocols: new Map()
    }

    this._registerTools()
  }

  /**
   * Registers all MCP tools with the server.
   *
   * @private
   */
  _registerTools () {
    registerWalletTools(this._server, this._state, this._config)
    registerTransferTools(this._server, this._state)
    registerSwapTools(this._server, this._state)
    registerBridgeTools(this._server, this._state)
    registerLendingTools(this._server, this._state)
    registerFiatTools(this._server, this._state)
  }

  /**
   * Starts the MCP server with stdio transport.
   *
   * @returns {Promise<void>}
   */
  async start () {
    const transport = new StdioServerTransport()
    await this._server.connect(transport)
    // IMPORTANT: Never use console.log for stdio servers - it corrupts JSON-RPC
    console.error('WDK MCP Server running on stdio')
  }

  /**
   * Gets the MCP server instance.
   *
   * @returns {McpServer}
   */
  getServer () {
    return this._server
  }

  /**
   * Gets the current server state.
   *
   * @returns {WdkMcpServerState}
   */
  getState () {
    return this._state
  }
}
