/**
 * Record the page drawing the cuts, so the README can lead with the thing
 * rather than with a description of the thing.
 *
 *   npm run capture
 *
 * The project's whole argument is that a token budget buys different amounts of
 * language, and the only honest way to show that is two columns of real text
 * with the cuts drawn on them, moving. A still frame of this page at its default
 * budget shows no cuts at all: at 512 tokens the first English rule is 1,503
 * pixels down, which is a screen and a half past where anybody stops looking.
 *
 * So the recording is choreographed against measured positions rather than
 * guessed at. Taken on 2026-09-24, viewport 1280 by 1500, page 5,848 tall:
 *
 *   budget  tokenizer   English rules  Greek rules  first English  first Greek
 *     1024    o200k            2            4           2407          1715
 *      128    o200k           20           35            785           678
 *      128   cl100k           20           83            785           625
 *
 * Those last two rows are the recording. The budget is held still and the
 * vocabulary changes, and the Greek column goes from 35 cuts to 83 while the
 * English one does not move at all. That is the sentence the README makes, on
 * screen, caused by a control the viewer can see being used.
 *
 * The frame is 900 pixels from y=350, which is the shortest band containing the
 * cause and the effect at once: the slider, the tokenizer, the status line, both
 * column heads, and 700 pixels of passage where the rules land. A band starting
 * lower shows more rules and no reason for them.
 *
 * The page is not scrolled. The first version of this scrolled to 350 and then
 * cropped from 350, which composes rather than cancels: the recording came out
 * at document y=700, all passage and no controls, a picture of cuts with nothing
 * on screen causing them. Looking at the output caught that. No number would
 * have.
 *
 * It takes its server from tools/serve.mjs like every other tool here, so the
 * page being filmed is proved byte for byte against dist/index.html first.
 * `tokenlab`'s capture starts its own on a hardcoded port and died with
 * ERR_CONNECTION_REFUSED on the afternoon that repository was published.
 *
 * And it writes down what the page looked like while it filmed, into
 * docs/capture.json, because a GIF cannot go stale loudly. `watch-it-think`
 * shipped a recording of a green page for two days after the page became flame
 * and blue, with the README underneath saying that was the real page, and
 * nothing anywhere failed. `check:capture` is the thing that fails.
 */

import { execFileSync } from 'node:child_process'
import { mkdirSync, renameSync, rmSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { serve } from './serve.mjs'
import { lookAt, FINAL } from './capture-state.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(root, 'docs/cuts.gif')
const WORK = resolve(root, '.capture')

const SIZE = { width: 1280, height: 1500 }
const FPS = 8
const WIDTH = 880

/*
 * The band, and why this one. 350 is just above the slider; 900 tall reaches
 * y=1250, which holds the first dozen Greek rules and the first two English
 * ones at the budget the recording ends on. Cropping before scaling so the
 * numbers above are the numbers in frame.
 */
const CROP = 'crop=1280:900:0:350'

rmSync(WORK, { recursive: true, force: true })
mkdirSync(WORK, { recursive: true })

const server = await serve()
let looked
let seconds

try {
  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: SIZE,
    deviceScaleFactor: 1,
    recordVideo: { dir: WORK, size: SIZE },
  })
  const videoStart = Date.now()

  const page = await context.newPage()
  await page.goto(server.url, { waitUntil: 'domcontentloaded' })

  // Wait for the vocabulary, not for a timeout. The recording should not open
  // on the word "loading".
  await page.waitForFunction(() => document.querySelectorAll('.rule').length > 0, null, { timeout: 120_000 })
  await page.waitForTimeout(500)

  const startedAt = Date.now()

  /*
   * Open on the largest budget, where the band is empty.
   *
   * It looks like a mistake for about a second and then it is the point: at
   * 1,024 tokens the first cut in either column is below this frame, so the
   * reader sees two columns of untouched text and then watches them fill.
   *
   * Driven from the keyboard rather than by setting .value, because a range
   * input that jumps has no thumb travel and the viewer cannot see what caused
   * anything. Arrow keys fire the page's own input event, which is also the
   * only path here that a real visitor takes.
   */
  await page.focus('[data-budget]')
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(140)
  }
  await page.waitForTimeout(1100)

  // Then down to 128, one step at a time, and the rules rain in.
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('ArrowLeft')
    await page.waitForTimeout(900)
  }
  await page.waitForTimeout(1300)

  /*
   * The comparison, held still. Same budget, same text, different vocabulary.
   * Waiting on the rule count rather than on a duration, because the page
   * fetches the cl100k vocabulary before it can draw with it and a fixed wait
   * would film either a stall or nothing.
   */
  await page.selectOption('[data-tokenizer]', FINAL.tokenizer)

  /*
   * Wait for stillness, not for the number. Waiting for the expected count turns
   * the wait into the assertion, and when it is wrong the tool dies with a bare
   * TimeoutError instead of the explicit message below, which says which value
   * moved and by how much. `check-capture.mjs` had the identical bug and its
   * control found it.
   */
  {
    const count = () => page.evaluate(() => document.querySelectorAll('[data-passage="el"] .rule').length)
    const deadline = Date.now() + 60_000
    let last = await count()
    for (;;) {
      await page.waitForTimeout(400)
      const now = await count()
      if ((now === last && now > 0) || Date.now() > deadline) break
      last = now
    }
  }
  await page.waitForTimeout(2200)

  looked = await page.evaluate(lookAt)
  seconds = (Date.now() - startedAt) / 1000

  // A recording of the wrong state is worse than no recording, and it costs
  // ninety seconds to find out at the end rather than in a gate tomorrow.
  const wrong = Object.entries(FINAL).filter(([k, v]) => looked.state[k] !== v)
  if (wrong.length > 0) {
    console.error('FAIL  the page did not reach the state this recording is choreographed for')
    for (const [k, v] of wrong) console.error(`      ${k}: wanted ${JSON.stringify(v)}, page is ${JSON.stringify(looked.state[k])}`)
    process.exit(1)
  }

  await context.close()
  await browser.close()

  const video = readdirSync(WORK).find((f) => f.endsWith('.webm'))
  if (!video) {
    console.error('FAIL  playwright wrote no video')
    process.exit(1)
  }
  const webm = resolve(WORK, video)

  // Before ffmpeg, not after. watch-it-think's first capture died pointing at
  // its own output directory.
  mkdirSync(resolve(root, 'docs'), { recursive: true })

  const ff = (args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' })
  const palette = resolve(WORK, 'palette.png')
  const filters = `${CROP},fps=${FPS},scale=${WIDTH}:-1:flags=lanczos`

  // Trim the vocabulary download off the front. What it costs belongs in the
  // README as a number, not as three seconds of a loop that plays forever.
  const LEAD_IN = 0.4
  const offset = Math.max(0, (startedAt - videoStart) / 1000 - LEAD_IN)
  const trim = ['-ss', String(offset)]

  /*
   * Sixteen colours, undithered, at eight frames a second. Every one of those
   * three was measured on this recording rather than copied from the other two
   * projects, because this is a different kind of picture: flat #080604, one
   * accent hue, and a great deal of small antialiased text in two scripts.
   *
   * 69 frames, 880 wide, undithered:
   *
   *   64 colours   4.99 MB
   *   32 colours   3.84 MB
   *   16 colours   2.21 MB
   *
   * That is not a linear saving and the reason is worth writing down. Playwright
   * records lossy webm, so every frame arrives carrying its own compression
   * noise, and two frames of a page that is standing perfectly still are not
   * identical any more. GIF only pays for what changes between frames, so that
   * noise was most of the file. A small palette quantises it back onto the same
   * few entries and the still frames go back to being still.
   *
   * Sixteen is not a compromise here, it is close to the true colour count: a
   * background, a card, a border, three greys of text, the flame rule and its
   * numeral. Looked at at 1:1 afterwards, Greek and Latin both stay crisp, which
   * is the only thing that could have vetoed it.
   *
   * Dithering, for the same reason, is worse than useless: it is designed to
   * break up gradients, there are none here, and it cost 11 per cent by putting
   * noise back into pixels that had just been made identical.
   *
   * Eight frames a second because nothing here moves continuously. A slider step
   * is discrete, the rules appear all at once, and the rest is a hold.
   */
  ff([...trim, '-i', webm, '-vf', `${filters},palettegen=max_colors=16:stats_mode=diff`, palette])
  ff([
    ...trim, '-i', webm,
    '-i', palette,
    '-lavfi', `${filters}[x];[x][1:v]paletteuse=dither=none`,
    '-loop', '0',
    OUT,
  ])

  renameSync(webm, resolve(root, 'docs/cuts.webm'))
  rmSync(WORK, { recursive: true, force: true })

  writeFileSync(
    resolve(root, 'docs/capture.json'),
    JSON.stringify({ recorded: new Date().toISOString().slice(0, 10), looked }, null, 2) + '\n',
  )
} finally {
  server.stop()
}

const { size } = await import('node:fs').then((m) => m.promises.stat(OUT))
console.log(`docs/cuts.gif    ${(size / 1e6).toFixed(2)} MB at ${FPS} fps, ${WIDTH}px wide`)
console.log(`docs/cuts.webm   kept alongside it, for anywhere that takes video`)
console.log(
  `ends on ${looked.state.tokenizer} at ${looked.state.budget} tokens: ` +
    `${looked.state.englishRules} English rules, ${looked.state.greekRules} Greek, ${seconds.toFixed(1)}s of action`,
)
