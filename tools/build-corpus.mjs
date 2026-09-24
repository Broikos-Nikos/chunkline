/**
 * Fetch the corpus once, commit it, and never depend on the network again.
 *
 *   node tools/build-corpus.mjs
 *
 * The first version of this lived outside the repository, fetched the **current**
 * revision of eight Wikipedia articles through the extracts API, recorded the
 * revision ids and **saved no text**. The measurement audit ran the same
 * processing a day later and found two articles already edited: the English
 * character count had moved by 259 and the English mid word count by three, from
 * 10 of 105 to 13 of 105.
 *
 * So every rate this project prints came from a document nobody could produce
 * again, which fails the one rule this workspace does not bend: a number is
 * produced by a command in the repository, or it is pinned with the file it came
 * from and that file's hash.
 *
 * This fetches and then **commits the prose**, which CC BY-SA 4.0 allows with
 * attribution, and records each article's revision id, fetch date and sha256.
 * After that the corpus is a file in `src/generated/`, the rates are computed
 * from that file, and `check:corpus` regenerates them and compares. The network
 * is needed once, to build it, and never to check it.
 *
 * Re-running this replaces the corpus with today's articles and changes the
 * numbers, which is correct: that is a new measurement and it says so in its own
 * `built` date. It is not run by the build and not run by any gate.
 */

import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const UA = 'chunkline-corpus/1.0 (https://github.com/Broikos-Nikos/chunkline; research)'

/*
 * Four topics, each with a substantial article written independently in both
 * languages: a city, a science article, a history article and a technology one.
 * Not chosen for length, and not translations of each other, which is what makes
 * a per language rate mean anything.
 */
const TOPICS = [
  { key: 'city', en: 'Thessaloniki', el: 'Θεσσαλονίκη' },
  { key: 'science', en: 'Photosynthesis', el: 'Φωτοσύνθεση' },
  { key: 'history', en: 'Byzantine Empire', el: 'Βυζαντινή Αυτοκρατορία' },
  { key: 'technology', en: 'Internet', el: 'Διαδίκτυο' },
]

async function article(lang, title) {
  const url =
    `https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts|revisions&explaintext=1` +
    `&rvprop=ids|timestamp&format=json&titles=${encodeURIComponent(title)}`
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`${lang}:${title} answered ${res.status}`)
  const page = Object.values((await res.json()).query.pages)[0]
  if (!page || page.missing !== undefined) throw new Error(`${lang}:${title} does not exist`)

  /*
   * Prose only. `explaintext` leaves section headings as bare lines and the
   * short fragments that were tables and captions, and a heading is not a
   * sentence: counting one as a boundary that failed to land on punctuation
   * would inflate the exact number this corpus exists to measure. The threshold
   * costs 4.0 percent of the English characters and 4.5 of the Greek, measured,
   * which is the check that it is not carrying the result.
   */
  const text = page.extract
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length >= 80)
    .join(' ')
    .replace(/\s+/g, ' ')

  return {
    title: page.title,
    revision: page.revisions?.[0]?.revid ?? null,
    edited: page.revisions?.[0]?.timestamp ?? null,
    text,
  }
}

const corpus = {
  what: 'The prose every rate in this project was measured on, committed so it can be measured again.',
  built: new Date().toISOString().slice(0, 10),
  source: 'Wikipedia',
  licence: 'CC BY-SA 4.0',
  attribution: 'Each article below, by its contributors, at the revision recorded.',
  articles: [],
}

for (const lang of ['en', 'el']) {
  for (const topic of TOPICS) {
    const a = await article(lang, topic[lang])
    corpus.articles.push({
      lang,
      topic: topic.key,
      title: a.title,
      revision: a.revision,
      edited: a.edited,
      fetched: corpus.built,
      characters: a.text.length,
      sha256: createHash('sha256').update(a.text, 'utf8').digest('hex'),
      url: `https://${lang}.wikipedia.org/w/index.php?oldid=${a.revision}`,
      text: a.text,
    })
    console.log(`  ${lang} ${topic.key.padEnd(11)} ${String(a.characters ?? a.text.length).padStart(7)} chars  rev ${a.revision}`)
  }
}

writeFileSync(resolve(root, 'src/generated/corpus-text.json'), JSON.stringify(corpus, null, 2) + '\n')
console.log(`\nwritten to src/generated/corpus-text.json, ${corpus.articles.length} articles`)
/*
 * And the rates, from that text and nothing else.
 *
 * Written by the same command so the two cannot come from different runs, which
 * is exactly what happened before: the rates were built from articles fetched on
 * one day and the page printed them on another, and nothing could tell.
 * `check:corpus` recomputes these from the committed text on every build, using
 * the same `rates.mjs` this does, because two copies of an arithmetic definition
 * drift and a gate with its own copy checks that two files agree about a bug.
 */
const { rateFor } = await import('./rates.mjs')
const rates = {
  what: 'Derived from corpus-text.json by tools/build-corpus.mjs. Do not edit: check:corpus regenerates and compares.',
  built: corpus.built,
  budget: 512,
  tokenizers: ['o200k', 'cl100k'],
  rates: {},
}
for (const lang of ['en', 'el']) {
  const joined = corpus.articles.filter((a) => a.lang === lang).map((a) => a.text).join(' ')
  rates.rates[lang] = {}
  for (const name of rates.tokenizers) rates.rates[lang][name] = rateFor(joined, name, rates.budget)
}
writeFileSync(resolve(root, 'src/generated/corpus.json'), JSON.stringify(rates, null, 2) + '\n')
console.log('written to src/generated/corpus.json, from that text and nothing else')
