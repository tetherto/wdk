'use strict'

import { createServer } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { dirname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, test } from '@jest/globals'

import { chromium } from 'playwright'

import { buildExample } from '../../examples/browser/build.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'examples', 'browser')

const TYPES = { '.html': 'text/html', '.js': 'text/javascript' }

let server, browser, page, origin

const pageErrors = []

function serve () {
  const server = createServer((req, res) => {
    const url = req.url === '/' ? '/index.html' : req.url
    const file = join(root, normalize(url).replace(/^(\.\.[/\\])+/, ''))

    if (!existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404)
      res.end()
      return
    }

    res.writeHead(200, { 'content-type': TYPES[file.slice(file.lastIndexOf('.'))] ?? 'application/octet-stream' })
    createReadStream(file).pipe(res)
  })

  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)))
}

describe('WDK in a browser', () => {
  beforeAll(async () => {
    await buildExample()

    server = await serve()
    origin = `http://127.0.0.1:${server.address().port}`

    browser = await chromium.launch()
    page = await browser.newPage()
    page.on('pageerror', (error) => pageErrors.push(String(error)))

    await page.goto(origin)
  }, 120000)

  afterAll(async () => {
    await browser?.close()
    await new Promise((resolve) => server?.close(resolve))
  })

  test('runs the orchestrator, the seed utilities and the policy engine', async () => {
    const result = await page.evaluate(() => globalThis.runBrowserExample())

    expect(result.seedPhraseWords).toBe(12)
    expect(result.seedPhraseValid).toBe(true)

    expect(result.address).toBe('demo-address-0')
    expect(result.addressByPath).toBe("demo-address-at-0'/0/7")
    expect(result.fastFeeRate).toBe('2')
    expect(result.middlewareSaw).toBe(2)

    expect(result.allowed).toBe('demo-tx:10')
    expect(result.denied).toBe('GOVERNED_BUT_UNMATCHED')
    expect(result.simulated).toBe('DENY')
  }, 60000)

  test('loads the page without a runtime error', () => {
    expect(pageErrors).toEqual([])
  })
})
