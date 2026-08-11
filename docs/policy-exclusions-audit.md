# Policy exclusions audit

Source of truth for `DEFAULT_POLICY_EXCLUSIONS` in `src/policy/constants.js`. Re-run this audit whenever a wallet or protocol package adds a public method, and update the constant to match Section D.

**Audit date:** 2026-08-11
**Scope:** every `wdk-*` repository under the `tetherto` GitHub org, public and private.
**Method:** shallow clone of every repo carrying account or protocol classes, then AST-shaped extraction of every public (non-`_`-prefixed, non-`static`) method on classes matching `WalletAccount*` / `*Protocol*`, classified per the rules below.

## Enumeration caveat — read this before trusting Section A

The audit brief specified enumeration via:

```bash
gh api /users/tetherto/repos --paginate --jq '.[].name' | sort
```

That endpoint returns **public repositories only** — 113 repos, 47 of them `wdk-*`. Enumerating through the org endpoint instead returns 128 repos, 58 of them `wdk-*`:

```bash
gh api "/orgs/tetherto/repos?type=all&per_page=100" --paginate --jq '.[].name'
```

The 11 repos the brief's command misses include **four private packages with real protocol surface**: `wdk-protocol-multisig-safe`, `wdk-protocol-bridge-usdt0-ton`, `wdk-protocol-swap-stonfi-ton`, `wdk-protocol-swap-aori-evm`. `wdk-protocol-multisig-safe` alone contributes 16 write methods (`approveTx`, `executeTx`, `addOwner`, …) and 19 reads. Auditing from the public list would have shipped a default list missing 8 read methods that exist only there, and would have left the org's most write-dense account class unexamined.

Anyone re-running this audit must use the org endpoint.

## Classification rules applied

| Class | Rule | Disposition |
|---|---|---|
| READ | Pure lookup/quote/derivation. No on-chain or remote state change, no signature produced. | Excluded (candidate) |
| LIFECYCLE | Connection and resource management, read-only view construction. | Excluded (candidate) |
| WRITE | Signs, broadcasts, moves value, or creates remote state. | **Governed** — never excluded |
| AMBIGUOUS | Name or behaviour unclear, or mutates state without moving value. | **Governed** — flagged in Section C for a human call |

Two decisions are load-bearing and worth stating explicitly:

1. **A `get*` prefix is not evidence of a read.** Three Spark methods are named `get*` and create remote state. They are classified WRITE. See Section C.
2. **Membership on a `*ReadOnly*` class is evidence of a read, but absence is not evidence of a write.** Quote methods and protocol capability lookups live only on write-capable classes and are still reads. Every method was classified on its documented behaviour, not its class placement.

---

## Section A — Packages checked

All 58 `wdk-*` repos under `tetherto` at audit time. "Surface" means account or protocol classes that the policy proxy could wrap.

| Repo | Accounts? | Protocols? | Notes |
|---|---|---|---|
| wdk | no | no | This package (wdk-core). Hosts the policy engine; installs `registerProtocol` + protocol getters onto accounts — see Section B. |
| wdk-wallet | yes (interfaces) | yes (bases) | `IWalletAccount*`, `WalletAccountReadOnly`, and all six protocol base classes. |
| wdk-wallet-aptos | yes | no | |
| wdk-wallet-btc | yes | no | |
| wdk-wallet-evm | yes | no | |
| wdk-wallet-evm-7702-gasless | yes | no | |
| wdk-wallet-evm-erc-4337 | yes | no | |
| wdk-wallet-solana | yes | no | |
| wdk-wallet-solana-gasless | yes | no | |
| wdk-wallet-spark | yes | no | Largest write surface of any wallet; source of the silent-bypass bug this PR fixes. |
| wdk-wallet-ton | yes | no | |
| wdk-wallet-ton-gasless | yes | no | |
| wdk-wallet-tron | yes | no | |
| wdk-wallet-tron-gasfree | yes | no | |
| wdk-protocol-bridge-usdt0-evm | no | yes | `Usdt0ProtocolEvm : BridgeProtocol` |
| wdk-protocol-bridge-usdt0-ton | no | yes | **private.** 3 bridge classes. |
| wdk-protocol-fiat-moonpay | no | yes | `MoonPayProtocol : FiatProtocol` |
| wdk-protocol-lending-aave-evm | no | yes | `AaveProtocolEvm : LendingProtocol` |
| wdk-protocol-multisig-safe | yes | yes | **private.** Multisig account pair; 16 writes, 19 reads. |
| wdk-protocol-swap-velora-evm | no | yes | `VeloraProtocolEvm : SwapProtocol` |
| wdk-protocol-swap-stonfi-ton | no | yes | **private.** 3 swap classes. |
| wdk-protocol-multisig-squads | no | no | README only, no source. |
| wdk-protocol-swap-aori-evm | no | no | **private.** Empty, no source. |
| wdk-safe-protocol-kit | no | no | Empty repository. |
| wdk-safe-relay-kit | no | no | Empty repository. |
| wdk-safe-core-sdk | no | no | Archived fork of the upstream Safe SDK; not a WDK account/protocol package. |
| wdk-agent-skills | no | no | Skill markdown. |
| wdk-asset-registry | no | no | Asset metadata. |
| wdk-backup-cloud | no | no | Backup transport. |
| wdk-backup-cloud-react-native | no | no | Backup transport. |
| wdk-backup-remote | no | no | Empty. |
| wdk-cli | no | no | CLI. |
| wdk-core-kotlin | no | no | Kotlin port; not consumed by this JS proxy. |
| wdk-core-swift | no | no | **private.** Swift port; not consumed by this JS proxy. |
| wdk-demo-wallet | no | no | **private.** Demo app. |
| wdk-docs | no | no | Docs. |
| wdk-docs-migration | no | no | **private.** Docs. |
| wdk-examples | no | no | Example apps. |
| wdk-failover-provider | no | no | RPC provider utility. |
| wdk-indexer-docs | no | no | **private.** Docs. |
| wdk-indexer-http | no | no | Indexer client. |
| wdk-mcp-toolkit | no | no | MCP server. |
| wdk-module-templates | no | no | **private.** Scaffolding templates, no source. |
| wdk-p2p-address-book | no | no | Address book. |
| wdk-playground | no | no | **private.** Scratch app; no account/protocol classes. |
| wdk-pricing-bitfinex-http | no | no | Pricing client. |
| wdk-pricing-coingecko-http | no | no | Pricing client. |
| wdk-pricing-provider | no | no | Pricing cache. |
| wdk-react-native-core | no | no | RN bindings. |
| wdk-react-native-secure-storage | no | no | RN storage. |
| wdk-secret-manager | no | no | Seed/secret utility. |
| wdk-signer-local | no | no | C native signer. |
| wdk-starter-kotlin | no | no | Starter app. |
| wdk-starter-react-native | no | no | Starter app. |
| wdk-starter-swift | no | no | **private.** Starter app. |
| wdk-uikit-react-native | no | no | UI components. |
| wdk-utils | no | no | Shared utilities. |
| wdk-worklet-bundler | no | no | Build tooling. |

Every repo with `no / no` was checked by listing its full git tree and confirming zero paths matching `wallet-account*`, `*-protocol*`, or `protocols/`.

---

## Section B — Classified methods per package

Accessors (`get index`, `get path`, `get keyPair`, `get address`) are omitted throughout: the proxy only intercepts callable own/inherited methods, so accessors never reach the engine. Inherited methods are listed on the class that declares them.

### wdk (this package)

`IWalletAccountWithProtocols : IWalletAccount` — installed onto every account by `_registerProtocols` before the policy proxy wraps it.

```
LIFECYCLE (must be excluded or the engine cannot compose):
  registerProtocol
  getBridgeProtocol, getFiatProtocol, getLendingProtocol,
  getSdaProtocol, getSwapProtocol, getSwidgeProtocol
```

These are not wallet methods, but under deny-by-default the proxy sees them like any other callable. Governing them would deny `account.getSwapProtocol('velora')` and make protocol access impossible. `simulate` is an object, not a function, so it is never intercepted.

### wdk-wallet (base interfaces and protocol bases)

```
IWalletAccountReadOnlySimple
  READ: getAddress, getBalance, getTokenBalance, getTransactionReceipt, verify
IWalletAccountReadOnly : IWalletAccountReadOnlySimple
  READ: quoteSendTransaction, quoteTransfer
IWalletAccount : IWalletAccountReadOnly
  LIFECYCLE: dispose, toReadOnlyAccount
  WRITE: sendTransaction, sign, signTransaction, transfer
IWalletAccountReadOnlyMultisig : IWalletAccountReadOnlySimple
  READ: getMessageProposal, getMessageProposals, getMultisigInfo, getProposal,
        getProposals, quoteExecuteProposal
IWalletAccountMultisig : IWalletAccountReadOnlyMultisig
  READ: getSignerAddress
  WRITE: approveMessageProposal, approveProposal, executeProposal, propose,
         proposeMessage, rejectProposal
ISwapProtocol / SwapProtocol
  READ: quoteSwap                      WRITE: swap
IBridgeProtocol / BridgeProtocol
  READ: quoteBridge                    WRITE: bridge
ILendingProtocol / LendingProtocol
  READ: quoteBorrow, quoteRepay, quoteSupply, quoteWithdraw
  WRITE: borrow, repay, supply, withdraw
IFiatProtocol / FiatProtocol
  READ: getSupportedCountries, getSupportedCryptoAssets,
        getSupportedFiatCurrencies, getTransactionDetail, quoteBuy, quoteSell
  WRITE: buy, sell
ISwidgeProtocol / SwidgeProtocol
  READ: getSupportedChains, getSupportedTokens, getSwidgeStatus, quoteSwidge,
        quoteSwap, quoteBridge
  WRITE: swidge, swap, bridge
ISdaProtocol / SdaProtocol
  READ: deriveDepositAddress, getDepositAddress, getSupportedRoutes, getTransfer,
        getTransfers, getTransfersByRecipient, quoteDeposit
  WRITE: createDepositAddress, disableDepositAddress, recoverDepositAddress,
         renewDepositAddress
```

`deriveDepositAddress` is a pure derivation used to verify or recover an address ("derive + compare" per its JSDoc) and creates nothing; `createDepositAddress` is the state-creating sibling and stays governed.

### wdk-wallet-aptos

```
WalletAccountReadOnlyAptos : WalletAccountReadOnly
  READ: getBalance, getTokenBalance, getTransaction, getTransactionReceipt,
        quoteSendTransaction, quoteTransfer, verify
WalletAccountAptos : WalletAccountReadOnlyAptos
  LIFECYCLE: dispose, toReadOnlyAccount
  WRITE: sendTransaction, sign, signTransaction, transfer
```

### wdk-wallet-btc

```
WalletAccountReadOnlyBtc : WalletAccountReadOnly
  READ: getBalance, getMaxSpendable, getTokenBalance, getTransactionReceipt,
        quoteSendTransaction, quoteTransfer, verify
  LIFECYCLE: dispose
WalletAccountBtc : WalletAccountReadOnlyBtc
  READ: getTransfers, quoteSendTransaction
  LIFECYCLE: dispose, toReadOnlyAccount
  WRITE: sendTransaction, sign, signTransaction, transfer
```

### wdk-wallet-evm

```
WalletAccountReadOnlyEvm : WalletAccountReadOnly
  READ: getAllowance, getBalance, getDelegation, getTokenBalance, getTokenBalances,
        getTransactionReceipt, quoteSendTransaction, quoteTransfer, verify,
        verifyTypedData
WalletAccountEvm : WalletAccountReadOnlyEvm
  READ: getAddress, quoteSendTransaction
  LIFECYCLE: dispose, toReadOnlyAccount
  WRITE: approve, delegate, revokeDelegation, sendTransaction, sign,
         signAuthorization, signTransaction, signTypedData, transfer
```

### wdk-wallet-evm-erc-4337 / wdk-wallet-evm-7702-gasless

Identical public surface.

```
WalletAccountReadOnly{EvmErc4337,Evm7702Gasless} : WalletAccountReadOnly
  READ: getAllowance, getBalance, getPaymasterTokenBalance, getTokenBalance,
        getTokenBalances, getTransactionReceipt, getUserOperationReceipt,
        quoteSendTransaction, quoteTransfer, verify, verifyTypedData
WalletAccount{EvmErc4337,Evm7702Gasless} : (above)
  READ: quoteSendTransaction
  LIFECYCLE: dispose, toReadOnlyAccount
  WRITE: approve, sendTransaction, sign, signTransaction, signTypedData, transfer
```

### wdk-wallet-solana / wdk-wallet-solana-gasless

```
WalletAccountReadOnlySolana[Gasless] : WalletAccountReadOnly
  READ: getBalance, getTokenBalance, getTokenBalances, getTransactionReceipt,
        quoteSendTransaction, quoteTransfer, verify
        (gasless adds: getPaymasterTokenBalance)
WalletAccountSolana[Gasless] : (above)
  READ: getAddress, quoteSendTransaction
  LIFECYCLE: dispose, toReadOnlyAccount
  WRITE: sendTransaction, sign, signTransaction, transfer
```

### wdk-wallet-ton / wdk-wallet-ton-gasless

```
WalletAccountReadOnlyTon[Gasless] : WalletAccountReadOnly
  READ: getBalance, getTokenBalance, getTransactionReceipt,
        quoteSendTransaction, quoteTransfer, verify
        (gasless adds: getPaymasterTokenBalance)
WalletAccountTon[Gasless] : (above)
  LIFECYCLE: dispose, toReadOnlyAccount
  WRITE: sendTransaction, sign, signTransaction, transfer
```

### wdk-wallet-tron / wdk-wallet-tron-gasfree

```
WalletAccountReadOnlyTron[Gasfree] : WalletAccountReadOnly
  READ: getBalance, getTokenBalance, getTransactionReceipt,
        quoteSendTransaction, quoteTransfer, verify
        (gasfree adds: getAddress)
WalletAccountTron[Gasfree] : (above)
  LIFECYCLE: dispose, toReadOnlyAccount
  WRITE: sendTransaction, sign, signTransaction, transfer
```

### wdk-wallet-spark

The package that motivated this PR. Twelve of its writes are invisible to the current `OPERATIONS` inclusion list.

```
WalletAccountReadOnlySpark : WalletAccountReadOnly
  READ: getBalance, getIdentityKey, getSparkInvoices, getStaticDepositAddresses,
        getTokenBalance, getTransactionReceipt, getTransfers,
        getUnusedDepositAddresses, getUtxosForDepositAddress,
        quoteSendTransaction, quoteTransfer, verify
WalletAccountSpark : WalletAccountReadOnlySpark
  READ: getAddress, getBalance, getLightningReceiveRequest,
        getLightningSendRequest, quotePayLightningInvoice, quoteWithdraw
  LIFECYCLE: cleanupConnections, dispose, toReadOnlyAccount
  WRITE: claimDeposit, claimStaticDeposit, createLightningInvoice,
         createSparkSatsInvoice, createSparkTokensInvoice, payLightningInvoice,
         paySparkInvoice, refundStaticDeposit, sendTransaction, sign,
         signTransaction, transfer, withdraw
  WRITE (despite get* name — see Section C):
         getSingleUseDepositAddress, getStaticDepositAddress
  AMBIGUOUS: syncWalletBalance
```

### wdk-protocol-multisig-safe (private)

```
WalletAccountReadOnlyMultisigEvmSafe4337 : WalletAccountReadOnly
  READ: getAddress, getBalance, getMessages, getMultisigInfo, getNonce, getOwners,
        getPaymasterTokenBalance, getProposals, getSignerAddress, getThreshold,
        getTokenBalance, getTransactionReceipt, getVersion, isDeployed,
        isReadyToExecute, quoteDeploy, quoteSendTransaction, quoteTransfer, verify
WalletAccountMultisigEvmSafe4337 : (above)
  READ: validateSignerIsOwner
  LIFECYCLE: dispose, toReadOnlyAccount
  WRITE: addOwner, approveMessage, approveTx, changeThreshold, deploy, executeTx,
         proposeMessage, rejectTx, removeOwner, sendTransaction, sign, swapOwner,
         transfer, updateOwners
```

`validateSignerIsOwner` returns `void` and throws when the signer is not an owner — a check, not a mutation.

### Protocol implementations

```
wdk-protocol-bridge-usdt0-evm  Usdt0ProtocolEvm : BridgeProtocol
  READ: getSupportedChains, getSupportedTokens, quoteBridge    WRITE: bridge
wdk-protocol-bridge-usdt0-ton  Usdt0ProtocolTon, InternalUsdt0ProtocolTon,
                               InternalUsdt0ProtocolTonGasless : BridgeProtocol
  READ: quoteBridge                                            WRITE: bridge
wdk-protocol-swap-velora-evm   VeloraProtocolEvm : SwapProtocol
  READ: quoteSwap                                              WRITE: swap
wdk-protocol-swap-stonfi-ton   StonFiProtocolTon, InternalStonFiProtocolTon,
                               InternalStonFiProtocolTonGasless : SwapProtocol
  READ: quoteSwap                                              WRITE: swap
wdk-protocol-fiat-moonpay      MoonPayProtocol : FiatProtocol
  READ: getSupportedCountries, getSupportedCryptoAssets,
        getSupportedFiatCurrencies, getTransactionDetail, quoteBuy, quoteSell
  WRITE: buy, sell
wdk-protocol-lending-aave-evm  AaveProtocolEvm : LendingProtocol
  READ: getAccountData, quoteBorrow, quoteRepay, quoteSupply, quoteWithdraw
  WRITE: borrow, repay, setUseReserveAsCollateral, setUserEMode, supply, withdraw
```

---

## Section C — Name collisions and traps

**No classification collisions detected across audited packages.** Every method name that appears in more than one package carries the same classification everywhere. The names that appear most widely were checked individually:

| Name | Appears on | Classification everywhere |
|---|---|---|
| `withdraw` | `LendingProtocol`, `AaveProtocolEvm`, `WalletAccountSpark` | WRITE |
| `quoteWithdraw` | same three | READ |
| `dispose` | every account, read-only and write | LIFECYCLE |
| `getAddress` | read-only and write classes across 6 packages | READ |
| `getTransfers` | `WalletAccountReadOnlySpark`, `WalletAccountBtc`, `SdaProtocol` | READ |
| `proposeMessage` | `IWalletAccountMultisig`, `WalletAccountMultisigEvmSafe4337` | WRITE |
| `getSignerAddress` | `IWalletAccountMultisig`, Safe read-only | READ |
| `swap` / `bridge` | 4 protocol packages + `SwidgeProtocol` | WRITE |

Because there are no collisions, no legitimate read had to be withheld from the default list on collision grounds.

### Traps worth recording

These are not collisions, but they are the failure modes a future re-audit is most likely to hit.

1. **`getStaticDepositAddress` (singular) is a WRITE; `getStaticDepositAddresses` (plural) is a READ.** One character apart, opposite classifications. Spark's singular form generates an address if one does not already exist; the plural form lists existing ones. Adding the singular to the default list would silently un-govern remote state creation.

2. **`getSingleUseDepositAddress` is a WRITE.** Its JSDoc: *"Generates a single-use deposit address."* A `get*` prefix carries no information about whether a method mutates.

3. **`syncWalletBalance` is AMBIGUOUS and stays governed.** Its JSDoc: *"Reconciles the wallet's internal state with the server and waits for any triggered optimisation to complete."* It moves no value and produces no signature, but it mutates local state and triggers server-side work, so it fails the READ definition. Consumers who want it ungoverned append it explicitly — see Section E.

---

## Section D — Proposed `DEFAULT_POLICY_EXCLUSIONS`

Union of READ and LIFECYCLE across every audited package, minus collisions (none) and minus the three flagged in Section C. 71 entries, sorted.

```js
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
```

`registerProtocol` and the six `get*Protocol` getters are wdk-core's own additions to the account surface, not wallet methods. They must be excluded or protocol access is denied on every governed account. `toReadOnlyAccount` must be excluded because the engine calls it to build the condition context — governing it would deadlock evaluation against itself.

### What this list newly governs

The 22-entry `OPERATIONS` inclusion list being deleted covered `sendTransaction, signTransaction, transfer, approve, sign, signTypedData, signAuthorization, delegate, revokeDelegation, swap, bridge, supply, withdraw, borrow, repay, buy, sell, swidge, createDepositAddress, renewDepositAddress, recoverDepositAddress, disableDepositAddress`.

Deny-by-default additionally governs these **28 write methods that previously bypassed the engine entirely**:

```
Spark (12):  claimDeposit, claimStaticDeposit, createLightningInvoice,
             createSparkSatsInvoice, createSparkTokensInvoice,
             getSingleUseDepositAddress, getStaticDepositAddress,
             payLightningInvoice, paySparkInvoice, refundStaticDeposit,
             syncWalletBalance, (withdraw was already covered)
Multisig (14): addOwner, approveMessage, approveMessageProposal, approveProposal,
             approveTx, changeThreshold, deploy, executeProposal, executeTx,
             propose, proposeMessage, rejectProposal, rejectTx, removeOwner,
             swapOwner, updateOwners
Aave (2):    setUseReserveAsCollateral, setUserEMode
```

---

## Section E — Deferred to consumer append

Only Spark has methods that a consumer may reasonably want ungoverned but that did not qualify for the default list.

```js
// wdk-wallet-spark consumers
const wdk = new WDK(SEED, {
  policyExclusions: [
    'syncWalletBalance'
  ]
})
```

`syncWalletBalance` — AMBIGUOUS per Section C. Excluded from defaults because it mutates local state and triggers remote work; a consumer who has read its implementation and accepts that can append it.

`getSingleUseDepositAddress` and `getStaticDepositAddress` are **deliberately not offered here**. Both create remote state and should stay governed; a consumer who wants them callable should register an ALLOW rule rather than exclude them, so the call is still evaluated and traced.

No other package required a deferred entry.

### Note on `cleanupConnections`

The audit brief's Section E example listed `cleanupConnections` as consumer-append, while its own Step 1.3 classification rule lists it as a LIFECYCLE candidate for the default list. Those two statements conflict. This audit follows Step 1.3 — the normative rule — and puts it in the defaults: closing connections moves no value, produces no signature, and gates nothing an attacker benefits from, while governing it would make `finally { await account.cleanupConnections() }` throw on any account without a matching ALLOW rule.
