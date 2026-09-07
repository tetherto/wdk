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

// Reads and lifecycle methods the proxy hands through without consulting the
// engine. Everything else on a governed account is evaluated, so an entry here
// is a hole in enforcement — add one only for a method that moves no value,
// produces no signature, and creates no remote state. Derived from an org-wide
// audit of every wdk-wallet-* and wdk-protocol-* package; see
// docs/policy-exclusions-audit.md, which is the source of truth for this list.
// Frozen because it is exported publicly: a consumer mutating the array in
// place would widen the exclusion set for every engine built afterwards in the
// same process, silently un-governing methods across unrelated WDK instances.
export const DEFAULT_POLICY_EXCLUSIONS = Object.freeze([
  'cleanupConnections',
  'deriveDepositAddress',
  'dispose',
  'getAccountData',
  'getAddress',
  'getAllowance',
  'getBalance',
  'getBridgeProtocol',
  'getDelegation',
  'getDepositAddress',
  'getFiatProtocol',
  'getIdentityKey',
  'getLendingProtocol',
  'getLightningReceiveRequest',
  'getLightningSendRequest',
  'getMaxSpendable',
  'getMessageProposal',
  'getMessageProposals',
  'getMessages',
  'getMultisigInfo',
  'getNonce',
  'getOwners',
  'getPaymasterTokenBalance',
  'getProposal',
  'getProposals',
  'getSdaProtocol',
  'getSignerAddress',
  'getSparkInvoices',
  'getStaticDepositAddresses',
  'getSupportedChains',
  'getSupportedCountries',
  'getSupportedCryptoAssets',
  'getSupportedFiatCurrencies',
  'getSupportedRoutes',
  'getSupportedTokens',
  'getSwapProtocol',
  'getSwidgeProtocol',
  'getSwidgeStatus',
  'getThreshold',
  'getTokenBalance',
  'getTokenBalances',
  'getTransaction',
  'getTransactionDetail',
  'getTransactionReceipt',
  'getTransfer',
  'getTransfers',
  'getTransfersByRecipient',
  'getUnusedDepositAddresses',
  'getUserOperationReceipt',
  'getUtxosForDepositAddress',
  'getVersion',
  'isDeployed',
  'isReadyToExecute',
  'quoteBorrow',
  'quoteBridge',
  'quoteBuy',
  'quoteDeploy',
  'quoteDeposit',
  'quoteExecuteProposal',
  'quotePayLightningInvoice',
  'quoteRepay',
  'quoteSell',
  'quoteSendTransaction',
  'quoteSupply',
  'quoteSwap',
  'quoteSwidge',
  'quoteTransfer',
  'quoteWithdraw',
  'registerProtocol',
  'toReadOnlyAccount',
  'validateSignerIsOwner',
  'verify',
  'verifyTypedData'
])

export const WILDCARD = '*'

export const SCOPES = ['project', 'account']

export const ACTIONS = ['ALLOW', 'DENY']
