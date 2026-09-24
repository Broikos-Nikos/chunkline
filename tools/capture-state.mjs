/**
 * What the recording is a recording of, in one place.
 *
 * `capture.mjs` films the page and writes this down; `check-capture.mjs` drives
 * the page to the same state and compares. If each of them described that state
 * in its own words, the gate would eventually be checking that two files agree
 * about a mistake, which is the failure `check-claims.mjs` was rewritten to
 * avoid in this same repository four days ago.
 *
 * Two things live here, and the difference between them is the whole design.
 *
 * `lookAt` runs in the browser and answers "what does this page look and say
 * right now". It is deliberately wider than a palette. `watch-it-think` wrote a
 * gate against a stale picture that recorded eight colours and a typeface, the
 * headline changed one commit later, and the gate passed over a recording of a
 * page saying something else. The complaint had been about the headline. So
 * this records the paint, the words, and the numbers on screen, because for this
 * project the numbers are what the picture is a picture of: a reader counts
 * eighty three rules in the Greek column, and if the page now draws a different
 * count then the picture is a lie no matter what colour it is.
 *
 * `FINAL` is the state the recording ends on, and it is computed rather than
 * typed. The rule counts come out of the committed passage through the
 * committed tokenizer, the same arithmetic `check:boundaries` holds the page to,
 * so if the corpus is ever rebuilt these move with it and the capture refuses
 * to film a state it was not choreographed for.
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { encode as encodeO200k } from 'gpt-tokenizer/encoding/o200k_base'
import { encode as encodeCl100k } from 'gpt-tokenizer/encoding/cl100k_base'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const passage = JSON.parse(readFileSync(resolve(root, 'src/generated/passage.json'), 'utf8'))

/** The budget the recording ends on, and the one the README's caption counts. */
export const CAPTURE_BUDGET = 128

/**
 * How many rules the page draws for this text at this budget.
 *
 * Literally the loop from `truth()` in check-boundaries.mjs and from
 * `boundariesOf()` in the page, counting instead of collecting offsets. Written
 * out rather than reduced to arithmetic on purpose: the closed form is off by
 * one at every exact multiple of the budget, and a gate that is cleverer than
 * the thing it guards is a gate that disagrees with it on one input a year.
 */
function ruleCount(encode, text, budget) {
  const ids = encode(text)
  let n = 0
  for (let i = budget; i < ids.length; i += budget) n++
  return n
}

/**
 * What both columns draw at the recording's budget, in both vocabularies.
 *
 * Exported so the README's caption can be held to it by `check:claims` rather
 * than typed by hand. The three numbers a reader can count off the picture are
 * the three numbers most likely to be quietly wrong.
 */
export const RULES = {
  o200k: {
    en: ruleCount(encodeO200k, passage.passages.en.text, CAPTURE_BUDGET),
    el: ruleCount(encodeO200k, passage.passages.el.text, CAPTURE_BUDGET),
  },
  cl100k: {
    en: ruleCount(encodeCl100k, passage.passages.en.text, CAPTURE_BUDGET),
    el: ruleCount(encodeCl100k, passage.passages.el.text, CAPTURE_BUDGET),
  },
}

/**
 * The end state, and why this one.
 *
 * The budget is held still and the vocabulary changes. That isolates the
 * variable the README says matters most: "the vocabulary matters more than the
 * language does". At 128 tokens on cl100k the Greek column carries more than
 * four times the cuts of the English one from the same subject at the same
 * length, and the English column has not moved at all since the frame before.
 *
 * A recording that ended on a budget change instead would show both columns
 * moving together, which is true and is not the finding.
 */
export const FINAL = {
  tokenizer: 'cl100k',
  budget: String(CAPTURE_BUDGET),
  englishRules: RULES.cl100k.en,
  greekRules: RULES.cl100k.el,
}

/**
 * Read the page. Runs inside the browser, in both tools, so what the capture
 * writes down and what the gate reads back are produced by one function.
 */
export function lookAt() {
  const s = getComputedStyle(document.documentElement)
  const paint = {}
  for (const k of ['--ink', '--lift', '--edge', '--text', '--dim', '--faint', '--flame', '--flame-bright']) {
    paint[k] = s.getPropertyValue(k).trim()
  }
  paint.bodyFont = getComputedStyle(document.body).fontFamily

  const words = {
    headline: document.querySelector('[data-headline]')?.textContent?.trim() ?? '',
    standfirst: document.querySelector('[data-standfirst]')?.textContent?.trim() ?? '',
    englishHead: document.querySelector('[data-meta-en]')?.textContent?.trim() ?? '',
    greekHead: document.querySelector('[data-meta-el]')?.textContent?.trim() ?? '',
    status: document.querySelector('[data-status]')?.textContent?.trim() ?? '',
  }

  const state = {
    tokenizer: document.querySelector('[data-tokenizer]')?.value ?? '',
    budget: document.querySelector('[data-budget-value]')?.textContent?.trim() ?? '',
    englishRules: document.querySelectorAll('[data-passage="en"] .rule').length,
    greekRules: document.querySelectorAll('[data-passage="el"] .rule').length,
  }

  return { paint, words, state }
}
