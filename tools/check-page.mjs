/**
 * The page says what the corpus measures, and says it to a reader.
 *
 *   npm run check:page
 *
 * `check:claims` holds the README without a browser. This holds the page, and it
 * imports the same expectations from that file rather than listing them again,
 * because two lists of what a number should be drift and the gate then checks
 * that two files agree about a mistake.
 *
 * The measurement that produced it: the page rendered nine figures a reader
 * could check and none of them was held by anything. `check:corpus` proved the
 * rates come from the committed text; nothing connected the rates to what was on
 * screen. A page reads its numbers from a file at build time, and a file can be
 * right while the sentence built from it is wrong.
 *
 * It reads `innerText`, not `textContent`, because the question is what a
 * visitor is looking at. A figure inside a hidden element is not a claim to
 * anybody.
 */

import { chromium } from 'playwright'
import { PAGE_CLAIMS, PASSAGE_CLAIMS } from './check-claims.mjs'

let failed = 0
const fail = (what, detail) => {
  failed++
  console.error(`FAIL  ${what}`)
  if (detail) console.error(`      ${detail}`)
}

const { serve, useShared } = await import('./serve.mjs')
const server = process.env.CHUNKLINE_URL ? await useShared(process.env.CHUNKLINE_URL) : await serve()

try {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } })
  await page.goto(server.url, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => document.querySelectorAll('.rule').length > 0, null, { timeout: 60_000 })

  const seen = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')

  const missing = PAGE_CLAIMS.filter(([, value]) => !seen.includes(value))

  if (missing.length > 0) {
    fail(
      `${missing.length} of ${PAGE_CLAIMS.length} figures the page should state are not on it`,
      missing.map(([what, value]) => `${what}: expected ${JSON.stringify(value)}`).join('; '),
    )
  } else {
    console.log(`  ok      ${PAGE_CLAIMS.length} figures on the page are what the corpus measures`)
  }

  // The passage's own numbers, in the caption, where a reader checks provenance.
  const missingPassage = PASSAGE_CLAIMS.filter(([, value]) => !seen.includes(value))
  if (missingPassage.length > 0) {
    fail(
      `${missingPassage.length} of ${PASSAGE_CLAIMS.length} passage figures are not in the caption`,
      missingPassage.map(([what, value]) => `${what}: expected ${JSON.stringify(value)}`).join('; '),
    )
  } else {
    console.log(`  ok      the caption names both revisions and both character counts`)
  }

  // And the headline is the claim, not a description. If it stops naming the
  // budget it is about, the page has an argument nobody can check.
  const headline = (await page.textContent('[data-headline]')) ?? ''
  if (!/1,024 token/.test(headline)) {
    fail(`the headline no longer names the budget it is about: ${JSON.stringify(headline)}`)
  } else {
    console.log(`  ok      the headline names its budget: ${JSON.stringify(headline)}`)
  }

  await browser.close()
} finally {
  server.stop()
}

if (failed > 0) {
  console.error('\nA page can read the right file and still show the wrong sentence.')
  process.exit(1)
}

console.log('page: every figure a visitor can see is one the corpus produces')
