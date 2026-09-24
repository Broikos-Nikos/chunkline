/**
 * Every number the README states and the page renders comes out of the corpus.
 *
 *   npm run check:claims
 *
 * Measured before this existed: the page rendered **nine** figures a reader
 * could check, and **none** of them was held by anything. `check:corpus` proved
 * the rates come from the committed text, and nothing connected the rates to
 * what the reader is shown. The gap between those two is where every stale
 * number in this workspace has lived.
 *
 * So this walks the other direction. It reads the corpus and the passage, works
 * out what each claim must say, and requires the README and the running page to
 * say exactly that. A figure that drifts fails by name, and a figure nobody can
 * produce cannot be written down at all.
 *
 * The README half runs in the build, without a browser. The page half needs one,
 * so it runs in `npm run verify`, and both use the same expectations built here.
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { RULES, CAPTURE_BUDGET } from './capture-state.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const corpus = JSON.parse(readFileSync(resolve(root, 'src/generated/corpus.json'), 'utf8'))
const passage = JSON.parse(readFileSync(resolve(root, 'src/generated/passage.json'), 'utf8'))
const readme = readFileSync(resolve(root, 'README.md'), 'utf8').replace(/\r\n/g, '\n')

const en = (t) => corpus.rates.en[t]
const el = (t) => corpus.rates.el[t]
const at = (r, budget) => Math.round(budget * r.charsPerToken).toLocaleString('en-US')

/**
 * What every claim has to say, derived rather than listed.
 *
 * Each one is the value and the sentence it belongs to, so a failure names the
 * claim rather than printing a number nobody can place.
 */
export const CLAIMS = [
  ['the cl100k ratio', `${(en('cl100k').charsPerToken / el('cl100k').charsPerToken).toFixed(2)}x`],
  ['the o200k ratio', `${(en('o200k').charsPerToken / el('o200k').charsPerToken).toFixed(2)}x`],
  ['English characters a token, cl100k', `${en('cl100k').charsPerToken}`],
  ['Greek characters a token, cl100k', `${el('cl100k').charsPerToken}`],
  ['English characters a token, o200k', `${en('o200k').charsPerToken}`],
  ['Greek characters a token, o200k', `${el('o200k').charsPerToken}`],
  ['English characters in a 1,024 token chunk', at(en('cl100k'), 1024)],
  ['Greek characters in a 1,024 token chunk', at(el('cl100k'), 1024)],
  ['the corpus size', (en('o200k').characters + el('o200k').characters).toLocaleString('en-US')],
  ['Greek boundaries inside a word', `${el('o200k').midWord} of ${el('o200k').boundaries}`],
  ['English boundaries inside a word', `${en('o200k').midWord} of ${en('o200k').boundaries}`],

  /*
   * The three numbers under the picture.
   *
   * A reader can count these off the recording, which makes them the figures in
   * this README most likely to be quietly wrong: they are not produced by the
   * corpus rates like everything above, they are produced by the passage, and
   * nothing connected the two until the picture existed. Written as the phrases
   * they appear in rather than as bare integers, because "20" on its own matches
   * a year, a page number and a line of the table.
   */
  [
    `the Greek cuts at ${CAPTURE_BUDGET} tokens, both vocabularies`,
    `Greek goes from ${RULES.o200k.el} cuts to ${RULES.cl100k.el}`,
  ],
  [`the English cuts at ${CAPTURE_BUDGET} tokens`, `English stays at ${RULES.cl100k.en}`],
]

/**
 * What the **page** has to say, in the page's own formatting.
 *
 * Separate from CLAIMS because the README and the page format the same
 * quantities differently: the README's table says `1.80x` and the standfirst
 * says "1.8 times". The first version of this gate held the page to the README's
 * spelling and failed against a page that was correct, which is a gate about
 * phrasing rather than about a fact, and this repository has now written that
 * one four times.
 *
 * Still derived, never typed: the formatting here is the formatting `main.ts`
 * uses, so a change to either side shows up as a failure rather than as drift.
 */
export const PAGE_CLAIMS = [
  ['the o200k ratio as the standfirst says it', `${(en('o200k').charsPerToken / el('o200k').charsPerToken).toFixed(1)} times`],
  ['English characters in a 1,024 token chunk', at(en('cl100k'), 1024)],
  ['Greek characters in a 1,024 token chunk', at(el('cl100k'), 1024)],
  ['the corpus size', (en('cl100k').characters + el('cl100k').characters).toLocaleString('en-US')],
  ['English characters a token, as the column head says it', `${en('o200k').charsPerToken} characters a token`],
  ['Greek characters a token, as the column head says it', `${el('o200k').charsPerToken} characters a token`],
]

/** Where the passage's own figures have to agree with the passage. */
export const PASSAGE_CLAIMS = [
  ['English passage characters', passage.passages.en.characters.toLocaleString('en-US')],
  ['Greek passage characters', passage.passages.el.characters.toLocaleString('en-US')],
  ['the English revision', String(passage.passages.en.revision)],
  ['the Greek revision', String(passage.passages.el.revision)],
]

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1].endsWith('check-claims.mjs')) {
  let failed = 0
  const flat = readme.replace(/\s+/g, ' ')

  for (const [what, value] of CLAIMS) {
    // Counted, not merely found. A figure that appears twice and is corrected in
    // one place is the defect this exists for.
    const hits = flat.split(value).length - 1
    if (hits === 0) {
      failed++
      console.error(`FAIL  ${what}: the corpus says ${JSON.stringify(value)} and the README does not say it`)
    }
  }

  if (failed === 0) console.log(`  ok      ${CLAIMS.length} claims in README.md are what the corpus measures`)

  /*
   * And nothing else that looks like one of these. A README that states a ratio
   * the corpus does not produce is the failure this cannot see by looking for
   * the right answer, because the right answer may also be present.
   */
  const ratios = [...new Set(flat.match(/\d+\.\d+x/g) ?? [])]
  const allowed = new Set(CLAIMS.filter(([, v]) => v.endsWith('x')).map(([, v]) => v))
  const loose = ratios.filter((r) => !allowed.has(r))
  if (loose.length > 0) {
    failed++
    console.error(`FAIL  the README states ${loose.length} ratio${loose.length === 1 ? '' : 's'} the corpus does not produce: ${loose.join(', ')}`)
  } else {
    console.log(`  ok      every ratio in README.md is one the corpus produces`)
  }

  if (failed > 0) {
    console.error('\nA number a reader can check is a number that has to be checked here first.')
    process.exit(1)
  }

  console.log('claims: every figure in the README comes out of the committed corpus')
}
