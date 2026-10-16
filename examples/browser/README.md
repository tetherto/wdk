# WDK in the browser

A minimal page that runs `@tetherto/wdk` in a browser: seed utilities, wallet
registration, account retrieval, fee rates, a middleware hook, and a policy that
allows one transaction and blocks another.

The repository's other entry points target Node.js and Bare. This example covers the
third runtime and records what it takes to get there.

## Running it

```bash
npm install
npm run build:example:browser
npx http-server examples/browser   # or any static server
```

Then open the page. The result of each step is rendered on it.

The same flow runs as a test in a real Chromium:

```bash
npx playwright install chromium
npm run test:browser
```

That test is not part of `npm test`, because it needs a browser binary that the
default test run does not.

## What the browser needs

The WDK's own sources need nothing. `index.js`, `src/wdk.js`,
`src/wallet-account-with-protocols.js` and everything under `src/policy/` reference no
Node built-in; `bare-node-runtime` is imported only from `bare.js`. The policy engine
works through `Proxy`, which every browser has, so governed accounts behave the same
here as they do on Node.

Two things come from `bip39@3.1.0`, which `@tetherto/wdk-wallet` depends on:

- **It is published as CommonJS.** No browser can load it natively, so bundling the
  example is required rather than a matter of taste. `build.js` drives esbuild's CLI
  through npx, so the bundler stays out of this package's dependency tree; any
  bundler will do.
- **It reads the global `Buffer`.** Browsers do not define it. `buffer-shim.js`
  supplies the binding, injected by the bundler wherever the name appears.

Both are properties of that dependency. Nothing in this repository has to change for a
browser to run the WDK.

## The demo wallet

`demo-wallet.js` implements `WalletManager` and `IWalletAccount` with no chain behind
them, so the example exercises the orchestrator without pulling a chain-specific
package into the bundle. It also shows the surface the policy engine needs from any
account: a derivation path, at least one write-facing operation, and
`toReadOnlyAccount()` — the engine refuses to govern an account that cannot produce a
read-only view.
