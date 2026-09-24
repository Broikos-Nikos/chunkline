/**
 * The picture at the top of the README is a picture of this page.
 *
 *   npm run check:capture
 *
 * A GIF cannot go stale loudly. Every other gate in this repository reads code,
 * a number or the rendered DOM, and not one of them can see that the image the
 * README leads with is a photograph of a page that no longer exists.
 *
 * This is not hypothetical and it is not borrowed. `watch-it-think` shipped a
 * recording made under a green palette, replaced the palette two ticks later,
 * and went on saying "That is the real page in a real browser" underneath a
 * picture of a different product for two days. Nothing failed. A recruiter audit
 * found it in ten seconds, which is exactly how long the picture gets.
 *
 * The gate written in response to that recorded eight colours and a typeface.
 * The headline then changed one commit later and it passed again, over a
 * recording of a page saying something else, while guarding a README sentence
 * claiming the picture was real. A gate written about a stale picture has to
 * look at everything a reader can see in the picture.
 *
 * So this compares three things, and the third is the one that matters here:
 *
 *   the paint, because a palette change makes it a picture of another site
 *   the words, because a headline change makes it a picture of another argument
 *   the counts, because this picture's whole content is how many rules are in
 *     each column, and a reader can sit and count them
 *
 * It does not compare pixels. A screenshot diff would fail on font hinting and
 * on every rebuild of the corpus, and a gate that cries wolf is a gate that gets
 * skipped.
 */

import { readFileSync, existsSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { lookAt, FINAL } from './capture-state.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const record = resolve(root, 'docs/capture.json')
const gif = resolve(root, 'docs/cuts.gif')

let failed = 0
const fail = (what, detail) => {
  failed++
  console.error(`FAIL  ${what}`)
  if (detail) console.error(`      ${detail}`)
}

if (!existsSync(gif)) {
  console.error('FAIL  docs/cuts.gif is missing, and the README leads with it')
  process.exit(1)
}
if (!existsSync(record)) {
  console.error('FAIL  docs/capture.json is missing, so nothing records what the page looked like when it was filmed')
  console.error('      run npm run capture')
  process.exit(1)
}

const was = JSON.parse(readFileSync(record, 'utf8'))

/*
 * A record from an older tool is refused rather than partly believed.
 *
 * `watch-it-think`'s first version of this compared whichever keys happened to
 * be present and printed ok, which means the day the capture tool learned to
 * write down something new, the gate went on passing without it. An incomplete
 * record is not a weaker record. It is no record of the thing that is missing.
 */
for (const part of ['paint', 'words', 'state']) {
  if (!was.looked || typeof was.looked[part] !== 'object') {
    fail(
      `docs/capture.json records no ${part}, so it was made before this gate read ${part}`,
      'Run npm run capture.',
    )
  }
}
if (failed > 0) process.exit(1)

/*
 * And the recording has to be of the state it is supposed to be of. If the
 * corpus is rebuilt, FINAL moves with it, and a recording of the old counts is
 * stale even though the page and the record still agree with each other.
 */
for (const [k, v] of Object.entries(FINAL)) {
  if (was.looked.state[k] !== v) {
    fail(
      `the recording ends on ${k} ${JSON.stringify(was.looked.state[k])}, but this corpus produces ${JSON.stringify(v)}`,
      'The passage or the tokenizer moved under the picture. Run npm run capture.',
    )
  }
}

/**
 * Wait for the page to stop redrawing, without asserting what it settles on.
 *
 * The first version of this waited for the Greek rule count to equal the number
 * the recording ends on, which reads like a wait and behaves like an assertion.
 * Its control proved the point: an off by one in the drawn rules made the gate
 * exit non-zero with a bare `TimeoutError` and no mention of rules, counts or
 * the picture. It had detected the right thing and said nothing useful about it.
 *
 * So this waits only for stillness, two equal readings in a row, and leaves
 * every judgement to the comparison below, which can name what moved.
 */
async function settle(page, { timeout = 60_000 } = {}) {
  /*
   * The whole state, not one part of it. The first version of the same helper in
   * `tokenlab` watched a chip count that was final the moment the stage redrew,
   * and then read a token figure that counts itself up over half a second, so it
   * settled on something that had never moved and read something still moving.
   * It called a correct page drifted.
   */
  const read = async () => JSON.stringify((await page.evaluate(lookAt)).state)
  const deadline = Date.now() + timeout
  let last = await read()
  for (;;) {
    await page.waitForTimeout(400)
    const now = await read()
    if (now === last || Date.now() > deadline) return
    last = now
  }
}

const { serve, useShared } = await import('./serve.mjs')
const server = process.env.CHUNKLINE_URL ? await useShared(process.env.CHUNKLINE_URL) : await serve()

try {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 1500 } })
  await page.goto(server.url, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => document.querySelectorAll('.rule').length > 0, null, { timeout: 120_000 })

  /*
   * Drive the page to the state the camera was pointed at. Comparing the
   * recording's end frame against the page's default would fail on the budget
   * and the vocabulary every single time, which is a gate that has to be
   * ignored to be used.
   */
  await page.selectOption('[data-tokenizer]', FINAL.tokenizer)
  await page.focus('[data-budget]')
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowLeft')
  await settle(page)
  // The standfirst is written during boot from the generated corpus, so an
  // empty one would read as drift when it is only impatience.
  await page.waitForFunction(
    () => (document.querySelector('[data-standfirst]')?.textContent ?? '').trim().length > 0,
    null,
    { timeout: 30_000 },
  )

  const now = await page.evaluate(lookAt)

  const drifted = []
  for (const part of ['paint', 'words', 'state']) {
    for (const [k, v] of Object.entries(was.looked[part])) {
      if (now[part][k] !== v) {
        drifted.push(`${part}.${k}: filmed ${JSON.stringify(v)}, page is ${JSON.stringify(now[part][k])}`)
      }
    }
  }

  if (drifted.length > 0) {
    fail(
      `the page has changed in ${drifted.length} way${drifted.length === 1 ? '' : 's'} since the recording was made on ${was.recorded}`,
      drifted.join('\n      ') + '\n      Run npm run capture. The README calls this the real page.',
    )
  } else {
    console.log(
      `  ok      the recording of ${was.recorded} is of this page: ` +
        `${was.looked.state.greekRules} Greek rules against ${was.looked.state.englishRules} English, ` +
        `at ${was.looked.state.budget} tokens on ${was.looked.state.tokenizer}`,
    )
  }

  await browser.close()
} finally {
  server.stop()
}

/*
 * The README claims the picture is the real page. That sentence is what this
 * gate exists to keep true, so if it goes, the gate is guarding nothing and
 * should say so rather than keep passing.
 *
 * Matched on a flattened README with `includes` rather than a regular
 * expression: the version of this in `watch-it-think` tested my memory of the
 * sentence twice and failed against a README that was correct.
 */
const readme = readFileSync(resolve(root, 'README.md'), 'utf8').replace(/\s+/g, ' ')
const CLAIM = 'That is the real page in a real browser, recorded by `npm run capture`'
if (!readme.includes(CLAIM)) {
  fail(
    'the README no longer claims the picture is the real page, so this gate is guarding nothing',
    `looked for: ${JSON.stringify(CLAIM)}`,
  )
} else {
  console.log('  ok      the README makes the claim this gate exists to keep true')
}

// Weight, because it is the first thing anybody downloads on a phone.
const mb = statSync(gif).size / 1e6
if (mb > 3.5) {
  fail(`docs/cuts.gif is ${mb.toFixed(2)} MB`, 'fewer frames and a shorter run, not a better encoder')
} else {
  console.log(`  ok      docs/cuts.gif is ${mb.toFixed(2)} MB`)
}

if (failed > 0) {
  console.error('\nThe picture at the top is the only thing most people will look at.')
  process.exit(1)
}

console.log('capture: the picture shows the page that exists, and the README can say so')
