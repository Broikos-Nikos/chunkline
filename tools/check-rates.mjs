/**
 * The number above a column is the rate of the text in that column.
 *
 *   npm run check:rates
 *
 * CME2-F5. The line above each column printed `corpus.json`'s rate, which is
 * pooled over four article pairs, 256,155 characters of English and 221,703 of
 * Greek. What is in the column is one passage of about 11,900 characters, and
 * it has its own rate. Measured at tick 185 against the committed passage:
 *
 *     printed above the column      the column's own text      difference
 *   o200k  en   4.76                4.643                      0.117
 *   o200k  el   2.64                2.609                      0.031
 *   cl100k en   4.62                4.580                      0.040
 *   cl100k el   1.13                1.112                      0.018
 *
 * A reader who divides the characters they can see by the tokens the page says
 * they cost gets a different number from the one over their head, and the page
 * gave them no way to know which text each number described: the footer, which
 * is where the corpus belongs, was empty.
 *
 * ## What this holds
 *
 *   1. For both vocabularies and both columns, the printed rate equals the
 *      characters of that passage divided by the tokens it encodes to,
 *      recomputed here from `passage.json` with `rates.mjs`'s codecs, which are
 *      the same two the page loads.
 *   2. The footer names the sample behind the standfirst's pooled figures: the
 *      article count from `corpus.json`, which `check:corpus` holds against the
 *      committed prose.
 *
 * The first is the assertion that bites. It is equality to the two decimals the
 * page prints rather than a tolerance, because both sides are the same division
 * of the same two integers and anything but equality means they are not.
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

import { CODECS } from './rates.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const passage = JSON.parse(readFileSync(resolve(root, 'src/generated/passage.json'), 'utf8'))
const corpus = JSON.parse(readFileSync(resolve(root, 'src/generated/corpus.json'), 'utf8'))

let failed = 0
const fail = (what, detail) => {
  failed++
  console.error(`FAIL  ${what}`)
  if (detail) console.error(`      ${detail}`)
}

/** What the column's own text costs, from the committed passage. */
const ownRate = (lang, id) => {
  const text = passage.passages[lang].text
  return text.length / CODECS[id].encode(text).length
}

const { serve, useShared } = await import('./serve.mjs')
const server = process.env.CHUNKLINE_URL ? await useShared(process.env.CHUNKLINE_URL) : await serve()

try {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
  await page.goto(server.url)
  await page.waitForFunction(() => /characters a token/.test(document.querySelector('[data-meta-en]')?.textContent ?? ''), null, {
    timeout: 120_000,
  })

  for (const id of ['o200k', 'cl100k']) {
    await page.selectOption('[data-tokenizer]', id)
    /* The second vocabulary is fetched on demand, 1.5 MB of it, and the line
       says "fetching" while it is in flight. Waiting for the status to settle
       is what stops this reading the previous vocabulary's numbers. */
    await page.waitForFunction(() => !/fetching/.test(document.querySelector('[data-status]')?.textContent ?? ''), null, {
      timeout: 120_000,
    })
    await page.waitForTimeout(250)

    for (const lang of ['en', 'el']) {
      const printed = await page.textContent(`[data-meta-${lang}]`)
      const m = /([\d.]+) characters a token/.exec(printed ?? '')
      if (!m) {
        fail(`${id} ${lang}: the column says ${JSON.stringify(printed)} and no rate could be read from it`)
        continue
      }
      const want = ownRate(lang, id).toFixed(2)
      if (m[1] !== want) {
        fail(
          `${id} ${lang}: the column prints ${m[1]} characters a token and its own text gives ${want}`,
          `${passage.passages[lang].text.length.toLocaleString('en-US')} characters in the column against the ` +
            `${corpus.rates[lang][id].characters.toLocaleString('en-US')} the pooled rate is measured on. ` +
            `A number above a column is a claim about that column.`,
        )
      } else {
        console.log(`  ok      ${id} ${lang}: the column prints ${m[1]}, which is its own text divided by its own tokens`)
      }
    }
  }

  const footer = (await page.textContent('[data-footer]'))?.replace(/\s+/g, ' ').trim() ?? ''
  if (!footer.includes(`${corpus.articles} Wikipedia articles`)) {
    fail(
      'the footer does not name the sample the standfirst is measured on',
      `it says ${JSON.stringify(footer.slice(0, 80))}, and corpus.json records ${corpus.articles} articles`,
    )
  } else {
    console.log(`  ok      the footer names the corpus, ${corpus.articles} articles over ${corpus.topics.length} subjects`)
  }

  await browser.close()
} finally {
  server.stop()
}

if (failed > 0) {
  console.error('\nA rate printed above a column is a claim about that column, whatever it was measured on.')
  process.exit(1)
}

console.log('rates: each column prints its own rate, and the footer says what the pooled one is measured on')
