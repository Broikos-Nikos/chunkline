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

        // The count first, because the comparison below walks the two together
        // and an extra rule would be compared against nothing.
        const rules = await page.evaluate(
          (l) => document.querySelectorAll(`[data-passage="${l}"] .rule`).length,
          lang,
        )
        if (rules !== want.length) {
          fail(`${lang} at ${budget} on ${id}: the page drew ${rules} rules and the tokenizer makes ${want.length} cuts`)
          continue
        }

        /*
         * What the page drew, checked against where the cut belongs, in one
         * round trip.
         *
         * For each rule: binary search for the last character whose line ends at
         * or above it, which is the character the rule points at, and compare
         * that character's line with the line of the character the tokenizer
         * says the cut falls after. A rule at the right height for the wrong
         * character passes a count check and is still a lie, and that is the
         * whole reason this end exists.
         *
         * The first version of this computed the search and discarded it with
         * `void drawn`, so the header described a check that did not run while a
         * second, weaker one did. Caught by the audit.
         */
        const wrong = await page.evaluate(
          ({ lang, want }) => {
            const host = document.querySelector(`[data-passage="${lang}"]`)
            const node = host.firstChild
            const top = host.getBoundingClientRect().top
            const range = document.createRange()
            const lineOf = (i) => {
              range.setStart(node, Math.min(i, node.length - 1))
              range.setEnd(node, Math.min(i + 1, node.length))
              return range.getBoundingClientRect().bottom - top
            }

            const bad = []
            for (const [i, rule] of [...host.querySelectorAll('.rule')].entries()) {
              const y = rule.getBoundingClientRect().bottom - top

              let lo = 0
              let hi = node.length - 1
              let points = 0
              while (lo <= hi) {
                const mid = (lo + hi) >> 1
                if (lineOf(mid) <= y + 0.5) {
                  points = mid
                  lo = mid + 1
                } else {
                  hi = mid - 1
                }
              }

              // Many characters share a line, so the test is that the rule points
              // at the same line as the cut, not at the same character.
              if (Math.abs(lineOf(points) - lineOf(want[i])) > 1) {
                bad.push({ i, points, want: want[i], ruleY: Math.round(y) })
              }
            }
            return bad
          },
          { lang, want },
        )

        if (wrong.length > 0) {
          fail(
            `${lang} at ${budget} on ${id}: ${wrong.length} rules are not on the line of the character they cut after`,
            `rule ${wrong[0].i} points at character ${wrong[0].points} and the cut is after ${wrong[0].want}`,
          )
        }
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
