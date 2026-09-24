/**
 * Every rate this project prints, recomputed from the text it was measured on.
 *
 *   npm run check:corpus
 *
 * `corpus.json` holds the numbers the page displays. `corpus-text.json` holds
 * the prose they were measured on. This regenerates the first from the second
 * and requires them to be identical, so a rate cannot drift from its evidence
 * and the evidence cannot go missing.
 *
 * It exists because they were not connected. The corpus was built by a script
 * outside the repository that fetched the current revision of eight Wikipedia
 * articles and saved no text, so nothing here could produce the numbers again.
 * The audit ran the same processing a day later, found two articles edited, and
 * got a different English mid word count: 13 of 105 where the file says 10 of
 * 105. Both were honest measurements of different documents.
 *
 * Each article also carries its own sha256, checked here, so a corpus edited by
 * hand fails rather than quietly becoming the new truth.
 */

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CODECS, rateFor } from './rates.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const text = JSON.parse(readFileSync(resolve(root, 'src/generated/corpus-text.json'), 'utf8'))
const rates = JSON.parse(readFileSync(resolve(root, 'src/generated/corpus.json'), 'utf8'))
const BUDGET = rates.budget ?? 512

let failed = 0
const fail = (what, detail) => {
  failed++
  console.error(`FAIL  ${what}`)
  if (detail) console.error(`      ${detail}`)
}

// ---- 1. the text is the text it says it is ---------------------------------
for (const a of text.articles) {
  const sha = createHash('sha256').update(a.text, 'utf8').digest('hex')
  if (sha !== a.sha256) {
    fail(`${a.lang} ${a.topic} does not match its own hash`, `recorded ${a.sha256.slice(0, 16)}, computed ${sha.slice(0, 16)}`)
  }
  if (a.text.length !== a.characters) {
    fail(`${a.lang} ${a.topic} is ${a.text.length} characters and records ${a.characters}`)
  }
}
if (failed === 0) console.log(`  ok      ${text.articles.length} articles match their own hashes and lengths`)

// ---- 2. every rate, recomputed ---------------------------------------------
const joined = {}
for (const lang of ['en', 'el']) {
  joined[lang] = text.articles.filter((a) => a.lang === lang).map((a) => a.text).join(' ')
}

for (const lang of ['en', 'el']) {
  for (const name of Object.keys(CODECS)) {
    const want = rateFor(joined[lang], name, BUDGET)

    const have = rates.rates?.[lang]?.[name]
    if (!have) {
      fail(`corpus.json has no rates for ${lang} on ${name}`)
      continue
    }
    const wrong = Object.entries(want).filter(([k, v]) => have[k] !== v)
    if (wrong.length > 0) {
      fail(
        `${lang} on ${name}: ${wrong.length} of ${Object.keys(want).length} rates do not come from the committed text`,
        wrong.map(([k, v]) => `${k}: file says ${have[k]}, the text gives ${v}`).join('; '),
      )
    } else {
      console.log(
        `  ok      ${lang} on ${name}: ${want.charsPerToken} characters a token, ` +
          `${want.midWord} of ${want.boundaries} boundaries inside a word`,
      )
    }
  }
}

if (failed > 0) {
  console.error('\nA rate whose evidence is not in the repository is a rate nobody can check.')
  process.exit(1)
}

console.log(`corpus: every rate recomputed from ${text.articles.length} committed articles, all identical`)
