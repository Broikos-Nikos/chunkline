/**
 * Every model this page names uses the vocabulary the page says it uses.
 *
 *   npm run check:encodings
 *
 * CME2-F2, the half of it that was still open. The picker said cl100k is used
 * by "GPT-4, GPT-3.5, and most deployed retrieval", and the README said the
 * same. "Most deployed retrieval" is a majority over a population nobody here
 * has counted, on a page whose entire argument is that a number comes from a
 * command. The measurement audit called it "a majority claim with nothing under
 * it" and that was exactly right: it was the one sentence here a skeptic could
 * not look up.
 *
 * What can be looked up is in `gpt-tokenizer`, which this project already
 * depends on to do the tokenising. It ships one module per model and each one
 * loads a named vocabulary. Counted at tick 186 across its 207 model modules:
 *
 *     o200k_base   148      cl100k_base   23      r50k_base   24
 *     p50k_base      8      p50k_edit      2      gpt2         2
 *
 * and the three OpenAI embedding models, which is what retrieval runs on, are
 * all three cl100k. So "every OpenAI embedding model" is three of three and
 * checkable, which is a stronger claim than "most" as well as an honest one.
 *
 * ## What this holds
 *
 *   1. Every model named in the picker and in the README table sits under the
 *      vocabulary it is named under, according to the package that ships here.
 *   2. "every OpenAI embedding model" means every one: the package's embedding
 *      modules are enumerated and all of them have to be cl100k. If OpenAI
 *      ships an o200k embedding model and this project updates the dependency,
 *      this fails and the sentence stops being true before a reader finds out.
 *
 * The second is the one that makes the first worth having. A list of names can
 * be kept correct by hand; a quantifier cannot, and the quantifier is what was
 * wrong.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const MODELS = resolve(root, 'node_modules/gpt-tokenizer/esm/model')

let failed = 0
const fail = (what, detail) => {
  failed++
  console.error(`FAIL  ${what}`)
  if (detail) console.error(`      ${detail}`)
}

if (!existsSync(MODELS)) {
  fail('gpt-tokenizer ships no model modules here, so nothing can be checked', `looked in ${MODELS}`)
  process.exit(1)
}

/** The vocabulary a model module loads, read from the module itself. */
const encodingOf = (model) => {
  const src = readFileSync(`${MODELS}/${model}.js`, 'utf8')
  const m = src.match(/bpeRanks\/([a-z0-9_]+)\.js/) ?? src.match(/encoding\/([a-z0-9_]+)\.js/)
  return m?.[1] ?? null
}

const all = readdirSync(MODELS)
  .filter((f) => f.endsWith('.js'))
  .map((f) => f.replace(/\.js$/, ''))

/* What the page and the README say, in the two places they say it. */
const label = readFileSync(resolve(root, 'src/lib/tokenizers.ts'), 'utf8')
const readme = readFileSync(resolve(root, 'README.md'), 'utf8')

const NAMED = [
  ['gpt-4', 'cl100k_base'],
  ['gpt-3.5-turbo', 'cl100k_base'],
  ['gpt-4o', 'o200k_base'],
  ['gpt-4.1', 'o200k_base'],
  ['gpt-5', 'o200k_base'],
]

for (const [model, want] of NAMED) {
  if (!all.includes(model)) {
    fail(`the page names ${model} and gpt-tokenizer ships no module for it`)
    continue
  }
  const got = encodingOf(model)
  if (got !== want) {
    fail(`${model} is named under ${want} and the package says ${got}`)
  }
}
if (failed === 0) {
  console.log(`  ok      all ${NAMED.length} models the page names use the vocabulary it names them under`)
}

/* The quantifier, which is the part that cannot be maintained by hand. */
const embeddings = all.filter((m) => m.startsWith('text-embedding'))
const strays = embeddings.filter((m) => encodingOf(m) !== 'cl100k_base')
/*
 * The labels, not the file. The first run of this read the whole of
 * `tokenizers.ts`, and the comment above the labels quotes the sentence this
 * gate holds, so the control that put "most deployed retrieval" back passed:
 * the phrase was still in the file, in the prose explaining why it should be.
 * Third time in this workspace that a new gate read its own argument as the
 * thing it was asserting about, after `check:promises` and `check:groups`.
 */
const labels = (label.match(/used: '([^']*)'/g) ?? []).join(' ')
const claimed = labels.includes('every OpenAI embedding model') && readme.includes('every OpenAI embedding model')

if (!claimed) {
  fail(
    'neither the picker nor the README makes the embedding claim this gate exists to hold',
    'if the sentence changed, change this gate with it rather than leaving an assertion about text nobody shows',
  )
} else if (embeddings.length === 0) {
  fail('the package ships no embedding modules, so "every OpenAI embedding model" asserts nothing')
} else if (strays.length > 0) {
  fail(
    `"every OpenAI embedding model" is on the page and ${strays.length} of ${embeddings.length} are not cl100k`,
    strays.map((m) => `${m} is ${encodingOf(m)}`).join('; '),
  )
} else {
  console.log(
    `  ok      every OpenAI embedding model is cl100k, ${embeddings.length} of ${embeddings.length}: ${embeddings.sort().join(', ')}`,
  )
}

/* And no majority claim comes back in through the labels. */
const WEASEL = /\b(most|majority of|nearly all|almost all|industry standard)\b/i
for (const [what, text] of [['the picker labels', labels]]) {
  if (WEASEL.test(text)) {
    fail(`${what} assert a majority again: ${JSON.stringify(text.match(WEASEL)[0])}`, text.slice(0, 120))
  } else {
    console.log(`  ok      ${what} claim nothing this repository cannot count`)
  }
}

if (failed > 0) {
  console.error('\nA claim about the world that no command here can produce is the one sentence a skeptic checks first.')
  process.exit(1)
}

console.log(`encodings: ${NAMED.length} models and ${embeddings.length} embeddings, every one as the page says`)
