/**
 * The repository carries the licence its README claims, and the corpus carries
 * the attribution its licence requires.
 *
 *   npm run check:licence
 *
 * Measured on 2026-09-25, an hour before this project was due to be published:
 *
 *   tokenlab         claims MIT   LICENSE present
 *   watch-it-think   claims MIT   LICENSE present
 *   chunkline        claims MIT   no LICENSE
 *   agentscope       claims MIT   no LICENSE
 *   evalkit          claims MIT   no LICENSE
 *   gatewaylab       claims MIT   no LICENSE
 *
 * Four repositories saying MIT in prose with nothing behind it. It is the ninety
 * second check a reviewer runs on a public repository, and the two that had a
 * licence had one because publishing them happened to include the step.
 *
 * `check:licences` in `tokenlab` is a different gate about fonts. This one is
 * about the sentence at the bottom of the README, which is a claim like any
 * other and had nothing holding it.
 *
 * Two halves, because this project makes two licence claims:
 *
 * 1. **MIT for the code.** A LICENSE file that says MIT and names a holder. Not
 *    a template with `[yyyy] [name of copyright owner]` still in it, which is
 *    how `tokenlab` shipped its font licence and is why that gate exists.
 * 2. **CC BY-SA 4.0 for the corpus**, which requires attribution, so every
 *    article in the committed corpus has to carry its source. A licence that
 *    says "with attribution" over a file with no attribution in it is worse
 *    than no claim, because it looks like diligence.
 */

import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

let failed = 0
const fail = (what, detail) => {
  failed++
  console.error(`FAIL  ${what}`)
  if (detail) console.error(`      ${detail}`)
}

const readme = readFileSync(resolve(root, 'README.md'), 'utf8').replace(/\r\n/g, '\n')
const flat = readme.replace(/\s+/g, ' ')

/*
 * What the README claims, read out of the README rather than assumed. If the
 * claim is ever rewritten, this reads the new one and holds the repository to
 * that instead of to a licence somebody hardcoded here.
 */
const claimsMit = /\bMIT\b/.test(flat)
const claimsCcBySa = /CC BY-SA/i.test(flat)

if (!claimsMit && !claimsCcBySa) {
  fail('the README claims no licence at all', 'A public repository with no licence is not open source, it is visible source.')
}

if (claimsMit) {
  const licPath = resolve(root, 'LICENSE')
  if (!existsSync(licPath)) {
    fail('the README says MIT and there is no LICENSE file', 'The claim is the easy half.')
  } else {
    const lic = readFileSync(licPath, 'utf8')
    if (!/MIT License/i.test(lic)) {
      fail('LICENSE does not say MIT and the README does', `LICENSE opens with ${JSON.stringify(lic.split('\n')[0])}`)
    } else if (/\[yyyy\]|\[name of copyright owner\]|\[fullname\]/i.test(lic)) {
      fail('LICENSE still has its template placeholders in it', 'tokenlab shipped exactly this and a reviewer found it in ninety seconds.')
    } else {
      const holder = lic.match(/Copyright \(c\) (\d{4}) (.+)/)
      if (!holder) {
        fail('LICENSE names no copyright holder', 'MIT without a holder grants nothing to anybody.')
      } else {
        console.log(`  ok      the README says MIT and LICENSE says MIT, ${holder[1]} ${holder[2].trim()}`)
      }
    }
  }
}

if (claimsCcBySa) {
  /*
   * The corpus is Wikipedia prose, and CC BY-SA is an attribution licence, so
   * the attribution has to be in the file rather than in the sentence claiming
   * it. Each article carries its title, its revision, its timestamp and a URL.
   */
  const corpusPath = resolve(root, 'src/generated/corpus-text.json')
  if (!existsSync(corpusPath)) {
    fail('the README claims CC BY-SA for a corpus that is not committed', 'Nothing to attribute means nothing was shipped under it.')
  } else {
    const corpus = JSON.parse(readFileSync(corpusPath, 'utf8'))
    const articles = corpus.articles ?? []
    if (articles.length === 0) {
      fail('the committed corpus lists no articles, so there is nothing carrying attribution')
    } else {
      const missing = articles.filter((a) => !a.url || !a.revision || !a.title)
      if (missing.length > 0) {
        fail(
          `${missing.length} of ${articles.length} articles carry no url, revision or title`,
          'CC BY-SA requires attribution, and an attribution nobody can follow is not one.',
        )
      } else if (!/CC BY-SA/i.test(JSON.stringify(corpus.licence ?? corpus.license ?? ''))) {
        fail('the committed corpus does not name the licence it is under', 'The README names it; the file should too.')
      } else {
        console.log(`  ok      all ${articles.length} articles carry a title, a revision and a url, under ${corpus.licence ?? corpus.license}`)
      }
    }
  }
}

if (failed > 0) {
  console.error('\nA licence claimed in prose and absent from the tree is the ninety second check a reviewer runs.')
  process.exit(1)
}

console.log('licence: every licence this README claims is one the repository carries')
