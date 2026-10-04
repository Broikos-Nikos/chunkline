/**
 * The page talks only to itself, and the browser is told to keep it that way.
 *
 *   npm run check:network      (or npm run verify, which starts the server)
 *
 * CNET-F1, swept out of `watch-it-think`'s WS-F2. The noscript block tells a
 * visitor this page "tokenises text in your browser to draw where a chunker
 * would cut it", and nothing held it. Measured at tick 190 on the built page:
 *
 *     6 requests, 5 on load and 1 when the second vocabulary was picked
 *     0 off this origin
 *     0 in localStorage, sessionStorage, document.cookie, service workers
 *
 * ## What this page is and is not claiming
 *
 * It never receives anything a visitor typed: the two passages are committed,
 * the only controls are a slider and a picker, and there is no text box. So the
 * claim is about **where the work happens**, not about privacy, and this gate
 * holds that: the vocabularies and the tokenising arrive and stay here. The
 * assertion about the passage not going out is kept anyway, because a page that
 * posted the text it is chunking would be doing the one thing the sentence says
 * it does not.
 *
 * ## The policy
 *
 * Stricter than `watch-it-think`'s, because this page needs less. No
 * `'wasm-unsafe-eval'` and no `blob:`: `gpt-tokenizer` is javascript, there is
 * no model to compile and no worker to start. The policy is checked for being
 * **in the head**, where a browser will take it, after `WICON-F1` showed what a
 * malformed icon does to a document: the head ended at the icon and the policy
 * was refused as "delivered via a <meta> element outside the document's
 * <head>". This project's icon was already encoded correctly, and so were the
 * other six.
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

let failed = 0
const fail = (what, detail) => {
  failed++
  console.error(`FAIL  ${what}`)
  if (detail) console.error(`      ${detail}`)
}

/* 1. The claim this gate exists to keep true, where it is made. */
const CLAIM = 'tokenises text in your browser'
const markup = readFileSync(resolve(root, 'index.html'), 'utf8').replace(/\s+/g, ' ')
if (!markup.includes(CLAIM)) {
  fail(
    `index.html no longer says ${JSON.stringify(CLAIM)}`,
    'If the promise changed, this gate changes with it rather than quietly guarding nothing.',
  )
} else {
  console.log('  ok      the page still makes the claim this gate holds')
}

const passage = JSON.parse(readFileSync(resolve(root, 'src/generated/passage.json'), 'utf8'))

const { serve, useShared } = await import('./serve.mjs')
const server = process.env.CHUNKLINE_URL ? await useShared(process.env.CHUNKLINE_URL) : await serve()

try {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
  const origin = new URL(server.url).origin
  const requests = []
  page.on('request', (r) =>
    requests.push({ url: r.url(), method: r.method(), type: r.resourceType(), body: r.postData() ?? '' }),
  )

  /* What the policy refused, which the request list cannot show: a blocked
     request never reaches it. `watch-it-think`'s first control passed for
     exactly that reason. */
  const refused = []
  page.on('console', (m) => {
    const t = m.text()
    if (m.type() === 'error' && /Content Security Policy|Refused to connect|violates the following/i.test(t)) {
      refused.push(t.replace(/\s+/g, ' ').slice(0, 140))
    }
  })

  await page.goto(server.url)
  await page.waitForFunction(() => document.querySelectorAll('.glance__tick').length > 0, null, { timeout: 180_000 })
  await page.waitForTimeout(1500)
  const onLoad = requests.length

  /* 2. The policy, in the head. */
  const policy = await page.evaluate(() => {
    const meta = document.head.querySelector('meta[http-equiv="Content-Security-Policy"]')
    return {
      inHead: Boolean(meta),
      anywhere: Boolean(document.querySelector('meta[http-equiv="Content-Security-Policy"]')),
      content: meta?.getAttribute('content') ?? '',
      bodyFirst: document.body.firstElementChild?.tagName?.toLowerCase() ?? '',
    }
  })
  if (!policy.inHead) {
    fail(
      policy.anywhere
        ? 'the Content-Security-Policy is in the document but not in the head, so the browser ignores it'
        : 'the page ships no Content-Security-Policy',
      `document.body.firstElementChild is <${policy.bodyFirst}>, which is where to look if the head ended early`,
    )
  } else if (!/connect-src 'self'/.test(policy.content)) {
    fail('the policy does not restrict connect-src to this origin', policy.content.slice(0, 120))
  } else if (/wasm-unsafe-eval|blob:/.test(policy.content)) {
    fail(
      'the policy permits wasm or blob, which this page has no use for',
      'gpt-tokenizer is javascript: there is no model to compile and no worker to start, so permitting them is permitting what nothing here asks for.',
    )
  } else {
    console.log('  ok      the policy is in the head, holds connect-src to this origin, and permits no wasm or blob')
  }

  /* Then everything a visitor can do: the second vocabulary and every budget. */
  await page.selectOption('[data-tokenizer]', 'cl100k')
  await page.waitForFunction(() => !/fetching/.test(document.querySelector('[data-status]')?.textContent ?? ''), null, {
    timeout: 120_000,
  })
  for (const i of [0, 1, 2, 3]) {
    await page.evaluate((v) => {
      const s = document.querySelector('[data-budget]')
      s.value = String(v)
      s.dispatchEvent(new Event('input', { bubbles: true }))
    }, i)
    await page.waitForTimeout(350)
  }
  await page.selectOption('[data-tokenizer]', 'o200k')
  await page.waitForTimeout(2000)

  /* 3. Everything it asked for, it asked of itself. */
  const foreign = requests.filter((r) => new URL(r.url).origin !== origin)
  if (foreign.length > 0) {
    fail(
      `${foreign.length} of ${requests.length} requests went to somebody else`,
      foreign.map((r) => `${r.method} ${r.type} ${r.url}`).join('\n      '),
    )
  } else {
    console.log(
      `  ok      ${requests.length} requests, every one to its own origin: ${onLoad} on load and ` +
        `${requests.length - onLoad} while the page was used`,
    )
  }

  /* 4. And nothing was refused, which is the half a blocked leak hides in. */
  if (refused.length > 0) {
    fail(
      `${refused.length} request${refused.length === 1 ? ' was' : 's were'} refused by the page's own policy`,
      refused.slice(0, 3).join('\n      ') + '\n      The policy doing its job is not the same as the code not trying.',
    )
  } else {
    console.log('  ok      the policy refused nothing, because nothing asked')
  }

  /* 5. And no request carried the text the page is chunking. */
  const sample = passage.passages.el.text.slice(200, 260)
  const carrying = requests.filter(
    (r) => r.url.includes(sample) || r.body.includes(sample) || decodeURIComponent(r.url).includes(sample),
  )
  if (carrying.length > 0) {
    fail(`${carrying.length} requests carried the passage this page is cutting`, carrying.map((r) => r.url.slice(0, 120)).join('\n      '))
  } else {
    console.log(`  ok      nothing carried the passage, checked on ${sample.length} characters of the Greek one`)
  }

  /* 6. And it kept nothing. */
  const kept = await page.evaluate(async () => ({
    localStorage: Object.keys(localStorage).length,
    sessionStorage: Object.keys(sessionStorage).length,
    cookie: document.cookie.length,
    workers: (await navigator.serviceWorker?.getRegistrations?.())?.length ?? 0,
  }))
  const stored = Object.entries(kept).filter(([, n]) => n > 0)
  if (stored.length > 0) {
    fail(`the page kept something: ${stored.map(([k, n]) => `${k} ${n}`).join(', ')}`)
  } else {
    console.log('  ok      nothing in localStorage, sessionStorage, cookies or a service worker')
  }

  await browser.close()
} finally {
  server.stop()
}

if (failed > 0) {
  console.error('\nA page that says the work happens in your browser has to be held to it by something that watches the wire.')
  process.exit(1)
}

console.log('network: every request is this page asking itself, and the browser is told to require it')
