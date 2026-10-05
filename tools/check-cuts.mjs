/**
 * The comparison is on the first screen, and a cut is drawn where it falls.
 *
 *   npm run check:cuts
 *
 * CME2-F4. The page's argument is two languages cut at the same budget, and
 * until tick 188 a reader had to scroll to meet any of it. Measured then:
 *
 *     viewport     columns start   first English rule   first Greek rule   rules on the first screen
 *     1280x800        559               1560                 1161                 0
 *     1920x1080       559               1560                 1161                 0
 *     390x844         596               2079                 8770                 0
 *
 * On a phone the two first rules sit **6,691 pixels apart**, so the side by
 * side comparison does not exist there at all. The fix is a pair of bars above
 * the fold, the same width because the two passages are within 25 characters of
 * each other, with a tick at every cut.
 *
 * The second half is where in a line the cut falls. A rule runs the width of
 * the column, so it says which line a chunk ends on and nothing about where, on
 * a page whose subject is the split word. Measured at 512 tokens on o200k:
 *
 *     en   5 cuts, 0 inside a word, 28 characters of the next chunk above the
 *          rule on average, 10 to 55, the cut 21 to 75 percent along its line
 *     el   8 cuts, 7 inside a word, 28 on average, 0 to 53, the cut 16 to 96
 *          percent along its line
 *
 * ## What this holds
 *
 *   1. Every tick and both bars are **above the fold** at 1280x800 and at
 *      390x844, because a comparison a reader has to scroll to is not the page
 *      leading with its argument.
 *   2. The ticks are the cuts: one per boundary in each language, and the
 *      count beside the bar is the chunk count the column states.
 *   3. Each tick sits at its cut's character offset, to within half a percent
 *      of the bar's width, so the drawing cannot drift from the arithmetic.
 *   4. Every cut inside the column carries the offset it was drawn from and
 *      agrees with the text about whether it fell inside a word.
 *   5. The page does not scroll sideways at 390. That is here rather than in a
 *      gate of its own because it is the same question as the first assertion,
 *      which is whether this page works on a phone. Tick 186 lengthened an
 *      option label and took the document from 391 pixels wide to 445, and no
 *      gate noticed for two ticks.
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

import { CODECS } from './rates.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const passage = JSON.parse(readFileSync(resolve(root, 'src/generated/passage.json'), 'utf8'))

let failed = 0
const fail = (what, detail) => {
  failed++
  console.error(`FAIL  ${what}`)
  if (detail) console.error(`      ${detail}`)
}

/** The offsets the page cuts at, computed here rather than read off the page. */
const cutsFor = (text, budget, id) => {
  const tk = CODECS[id]
  const ids = tk.encode(text)
  const out = []
  for (let i = budget; i < ids.length; i += budget) out.push(tk.decode(ids.slice(0, i)).length)
  return out
}

const LETTER = /\p{L}/u
const OPENING = { id: 'o200k', budget: 512 }

const { serve, useShared } = await import('./serve.mjs')
const server = process.env.CHUNKLINE_URL ? await useShared(process.env.CHUNKLINE_URL) : await serve()

try {
  const browser = await chromium.launch()

  // ---- 1 and 5: the first screen, at both widths --------------------------
  for (const [w, h] of [
    [1280, 800],
    [390, 844],
  ]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } })
    await page.goto(server.url)
    await page.waitForFunction(() => document.querySelectorAll('[data-tick]').length > 0, null, { timeout: 180_000 })
    await page.waitForTimeout(300)

    const seen = await page.evaluate(() => {
      const d = document.documentElement
      const g = document.querySelector('[data-glance]').getBoundingClientRect()
      const ticks = [...document.querySelectorAll('[data-tick]')]
      return {
        glanceBottom: Math.round(g.bottom + window.scrollY),
        fold: window.innerHeight,
        ticks: ticks.length,
        below: ticks.filter((t) => t.getBoundingClientRect().bottom + window.scrollY > window.innerHeight).length,
        scrollWidth: d.scrollWidth,
        clientWidth: d.clientWidth,
      }
    })

    if (seen.below > 0 || seen.glanceBottom > seen.fold) {
      fail(
        `at ${w}x${h} the comparison is not on the first screen`,
        `it ends at ${seen.glanceBottom} against a fold of ${seen.fold}, with ${seen.below} of ${seen.ticks} ticks below it`,
      )
    } else {
      console.log(
        `  ok      at ${w}x${h} all ${seen.ticks} ticks are above the fold, the comparison ending at ${seen.glanceBottom} of ${seen.fold}`,
      )
    }

    if (seen.scrollWidth > seen.clientWidth) {
      fail(
        `at ${w} the page scrolls sideways: ${seen.scrollWidth} against ${seen.clientWidth}`,
        'a phone that scrolls sideways hides half of a two column comparison on the axis it cannot afford',
      )
    } else {
      console.log(`  ok      at ${w} nothing pushes the page wider than the window`)
    }
    await page.close()
  }

  // ---- 2, 3 and 4: the ticks are the cuts ---------------------------------
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await page.goto(server.url)
  await page.waitForFunction(() => document.querySelectorAll('[data-tick]').length > 0, null, { timeout: 180_000 })
  await page.waitForTimeout(400)

  for (const lang of ['en', 'el']) {
    const text = passage.passages[lang].text
    const cuts = cutsFor(text, OPENING.budget, OPENING.id)
    const drawn = await page.evaluate((l) => {
      const bar = document.querySelector(`[data-glance-bar="${l}"]`)
      const box = bar.getBoundingClientRect()
      return {
        ticks: [...bar.querySelectorAll('[data-tick]')].map((t) => ({
          at: Number(t.dataset.at),
          inside: t.dataset.inside === 'true',
          share: (t.getBoundingClientRect().left - box.left) / box.width,
        })),
        count: document.querySelector(`[data-glance-count="${l}"]`)?.textContent ?? '',
        cuts: [...document.querySelectorAll(`[data-passage="${l}"] .cut`)].map((c) => ({
          at: Number(c.dataset.at),
          inside: c.dataset.inside === 'true',
        })),
      }
    }, lang)

    if (drawn.ticks.length !== cuts.length) {
      fail(`${lang}: the bar carries ${drawn.ticks.length} ticks and the passage has ${cuts.length} cuts`)
      continue
    }
    if (!drawn.count.startsWith(`${cuts.length + 1} chunks`)) {
      fail(`${lang}: the bar says ${JSON.stringify(drawn.count)} and ${cuts.length} cuts make ${cuts.length + 1} chunks`)
    }

    const wrongAt = drawn.ticks.filter((t, i) => t.at !== cuts[i])
    const wrongPlace = drawn.ticks.filter((t, i) => Math.abs(t.share - cuts[i] / text.length) > 0.005)
    if (wrongAt.length > 0) {
      fail(`${lang}: ${wrongAt.length} ticks are not at the offsets the tokenizer cuts at`)
    } else if (wrongPlace.length > 0) {
      fail(
        `${lang}: ${wrongPlace.length} ticks are drawn away from their own offset`,
        wrongPlace
          .slice(0, 3)
          .map((t, i) => `${(100 * t.share).toFixed(1)}% against ${((100 * cuts[i]) / text.length).toFixed(1)}%`)
          .join('; '),
      )
    } else {
      console.log(`  ok      ${lang}: ${cuts.length} ticks, each at the character its chunk ends on`)
    }

    /* The marks in the column, which are the half of this finding the page is
       actually about. */
    const wantInside = cuts.filter((at) => LETTER.test(text[at] ?? '') && LETTER.test(text[at + 1] ?? '')).length
    if (drawn.cuts.length !== cuts.length) {
      fail(`${lang}: ${drawn.cuts.length} cuts are marked in the column and the passage has ${cuts.length}`)
    } else {
      const wrong = drawn.cuts.filter(
        (c) => c.inside !== (LETTER.test(text[c.at] ?? '') && LETTER.test(text[c.at + 1] ?? '')),
      )
      if (wrong.length > 0) {
        fail(`${lang}: ${wrong.length} cuts disagree with the text about falling inside a word`)
      } else {
        console.log(
          `  ok      ${lang}: every cut is marked inside its line, ${wantInside} of ${cuts.length} inside a word`,
        )
      }
    }
  }

  await browser.close()
} finally {
  server.stop()
}

if (failed > 0) {
  console.error('\nA comparison a reader has to scroll to find is a comparison the page did not make.')
  process.exit(1)
}

console.log('cuts: the comparison is on the first screen at both widths, and every cut is drawn where it falls')
