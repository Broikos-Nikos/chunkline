/**
 * The rules the page draws are the cuts the tokenizer makes.
 *
 *   npm run check:boundaries
 *
 * This is the gate this project exists to have. Everything else here is a page;
 * this is the thing that stops the page becoming a drawing.
 *
 * The risk is specific and it is not hypothetical. `src/generated/passage.json`
 * holds boundary offsets computed on 2026-09-23, and the page recomputes them in
 * the browser on every render. Those two can disagree in three ways, and each
 * one has happened to a project in this workspace:
 *
 *   the page draws the committed answer and stops measuring anything
 *   the page measures correctly and the committed file goes stale
 *   both are right and the rules are drawn at the wrong height
 *
 * So the gate checks all three ends against each other. It recomputes the
 * boundaries itself, in node, from the committed passage text with the committed
 * tokenizer, and holds both the file and the page to that.
 *
 * The third end is the one a reader sees. A rule is positioned at a character
 * offset, so the gate takes the rule's own y coordinate and asks the browser
 * which character sits on that line: if the rule says the cut is after character
 * 2,470, the line it is drawn on has to contain character 2,470.
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { encode as encodeO200k, decode as decodeO200k } from 'gpt-tokenizer/encoding/o200k_base'
import { encode as encodeCl100k, decode as decodeCl100k } from 'gpt-tokenizer/encoding/cl100k_base'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const passage = JSON.parse(readFileSync(resolve(root, 'src/generated/passage.json'), 'utf8'))

const CODECS = {
  o200k: { encode: encodeO200k, decode: decodeO200k },
  cl100k: { encode: encodeCl100k, decode: decodeCl100k },
}

let failed = 0
const fail = (what, detail) => {
  failed++
  console.error(`FAIL  ${what}`)
  if (detail) console.error(`      ${detail}`)
}

/** The answer this gate computes for itself, and holds everything else to. */
function truth(text, budget, codec) {
  const ids = codec.encode(text)
  const cuts = []
  for (let i = budget; i < ids.length; i += budget) cuts.push(codec.decode(ids.slice(0, i)).length)
  return cuts
}

const LANGS = ['en', 'el']
const BUDGETS = [128, 256, 512, 1024]

// ---- 1. the committed file, against the tokenizer ---------------------------
//
// `chunkline-passage.json` was written by a script in the workspace and copied
// in. If the passage text and the offsets ever came from different runs, every
// number on the page would be quietly wrong.
{
  let checked = 0
  for (const budget of BUDGETS) {
    for (const lang of LANGS) {
      const want = truth(passage.passages[lang].text, budget, CODECS[passage.tokenizer])
      const have = passage.boundaries[String(budget)][lang]
      checked += want.length
      if (want.length !== have.length || want.some((v, i) => v !== have[i])) {
        fail(
          `the committed offsets for ${lang} at ${budget} do not match the tokenizer`,
          `file has ${have.length} cuts, ${passage.tokenizer} gives ${want.length}: ` +
            `first difference at ${want.findIndex((v, i) => v !== have[i])}`,
        )
      }
    }
  }
  if (failed === 0) console.log(`  ok      ${checked} committed offsets are what ${passage.tokenizer} produces`)
}

// ---- 2 and 3: the page, against the same answer -----------------------------
const { serve, useShared } = await import('./serve.mjs')
const server = process.env.CHUNKLINE_URL ? await useShared(process.env.CHUNKLINE_URL) : await serve()

try {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } })
  await page.goto(server.url, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => document.querySelectorAll('.rule').length > 0, null, { timeout: 60_000 })

  for (const id of Object.keys(CODECS)) {
    await page.selectOption('[data-tokenizer]', id)
    await page.waitForFunction(
      (want) => document.querySelector('[data-tokenizer]').value === want &&
        !/fetching/.test(document.querySelector('[data-status]').textContent),
      id,
      { timeout: 120_000 },
    )

    for (const [index, budget] of BUDGETS.entries()) {
      await page.fill('[data-budget]', String(index))
      await page.dispatchEvent('[data-budget]', 'input')
      await page.waitForTimeout(150)

      for (const lang of LANGS) {
        const want = truth(passage.passages[lang].text, budget, CODECS[id])

        /*
         * What the page drew, converted back into character offsets.
         *
         * Each rule's top is read, and the browser is asked which character the
         * line ending at that y contains. That is the assertion that matters: a
         * rule at the right y for the wrong character would pass a count check
         * and be a lie, and a rule drawn from the right number at the wrong
         * height is the defect a reader actually sees.
         */
        const drawn = await page.evaluate(
          ({ lang }) => {
            const host = document.querySelector(`[data-passage="${lang}"]`)
            const node = host.firstChild
            const top = host.getBoundingClientRect().top
            const range = document.createRange()
            return [...host.querySelectorAll('.rule')].map((rule) => {
              const y = rule.getBoundingClientRect().bottom - top
              // Binary search for the last character whose line ends at or above
              // this rule: that character is the one the cut falls after.
              let lo = 0
              let hi = node.length - 1
              let best = 0
              while (lo <= hi) {
                const mid = (lo + hi) >> 1
                range.setStart(node, mid)
                range.setEnd(node, mid + 1)
                const bottom = range.getBoundingClientRect().bottom - top
                if (bottom <= y + 0.5) {
                  best = mid
                  lo = mid + 1
                } else {
                  hi = mid - 1
                }
              }
              return best
            })
          },
          { lang },
        )

        if (drawn.length !== want.length) {
          fail(
            `${lang} at ${budget} on ${id}: the page drew ${drawn.length} rules and the tokenizer makes ${want.length} cuts`,
          )
          continue
        }

        // The rule is on the line its character sits on. A line holds many
        // characters, so the test is that the drawn line contains the offset,
        // not that it equals it.
        const wrong = []
        for (const [i, offset] of want.entries()) {
          const line = await page.evaluate(
            ({ lang, offset }) => {
              const node = document.querySelector(`[data-passage="${lang}"]`).firstChild
              const range = document.createRange()
              range.setStart(node, Math.min(offset, node.length - 1))
              range.setEnd(node, Math.min(offset + 1, node.length))
              return range.getBoundingClientRect().bottom
            },
            { lang, offset },
          )
          const ruleBottom = await page.evaluate(
            ({ lang, i }) =>
              document.querySelectorAll(`[data-passage="${lang}"] .rule`)[i].getBoundingClientRect().bottom,
            { lang, i },
          )
          if (Math.abs(line - ruleBottom) > 1) wrong.push({ i, offset, line, ruleBottom })
        }

        if (wrong.length > 0) {
          fail(
            `${lang} at ${budget} on ${id}: ${wrong.length} rules are not on the line of the character they cut after`,
            `rule ${wrong[0].i} is at ${wrong[0].ruleBottom.toFixed(0)} and character ${wrong[0].offset} ends at ${wrong[0].line.toFixed(0)}`,
          )
        }

        void drawn
      }
    }
  }

  if (failed === 0) {
    console.log(`  ok      the page drew the right number of rules for ${BUDGETS.length} budgets and both vocabularies`)
    console.log('  ok      every rule sits on the line of the character it cuts after')
  }

  await browser.close()
} finally {
  server.stop()
}

if (failed > 0) {
  console.error('\nA page that draws a committed answer is a picture of a measurement.')
  process.exit(1)
}

console.log('boundaries: the file, the tokenizer and the page all agree, at every budget and both vocabularies')
