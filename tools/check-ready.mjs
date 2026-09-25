/**
 * The controls do nothing only while they say they can do nothing.
 *
 *   npm run check:ready
 *
 * Swept out of `watch-it-think`'s WH-F4 at tick 166. Both controls on this page
 * used to ship usable, and `render()` has no readiness guard: the slider's
 * listener calls `encoderFor`, which throws
 *
 *   o200k was not loaded before it was drawn with
 *
 * inside an event listener, where nothing a visitor can see happens. Two
 * megabytes of vocabulary arrive first, measured at 2 Mbit: the slider exists
 * from first paint, the module attaches its listener about a second later, and
 * between those two moments moving it does not even throw.
 *
 * `disabled` in the markup rather than in script, because the script is part of
 * what is still downloading. That is the same lesson as `watch-it-think`'s
 * WH-F2, where a box typeable from first paint had its contents replaced 1,356 ms
 * later by code that had only just started.
 *
 * ## What is checked
 *
 *   the markup ships both controls disabled
 *   they are still disabled while the vocabulary arrives, and `.controls` is
 *     aria-busy
 *   they work once it is here, and the page has drawn something
 *   choosing the other tokenizer disables them again until that one lands
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** 2 Mbit. The vocabulary is 2 MB, so this is about eight seconds of window. */
const THROTTLE = { downloadThroughput: (2 * 1024 * 1024) / 8, uploadThroughput: (1 * 1024 * 1024) / 8, latency: 60 }

let failed = 0
const fail = (what, detail) => {
  failed++
  console.error(`FAIL  ${what}`)
  if (detail) console.error(`      ${detail}`)
}

const html = readFileSync(resolve(root, 'index.html'), 'utf8')
for (const [what, pattern] of [
  ['the budget slider', /<input[^>]*data-budget[^>]*\sdisabled/],
  ['the tokenizer select', /<select[^>]*data-tokenizer[^>]*\sdisabled/],
  ['the controls', /<div class="controls"[^>]*aria-busy="true"/],
]) {
  if (!pattern.test(html)) {
    fail(`index.html does not ship ${what} disabled`, 'Script cannot disable a control before the script has arrived, which is the whole of the window this gate is about.')
  }
}
if (failed === 0) console.log('  ok      index.html ships both controls disabled and the group busy')

const { serve, useShared } = await import('./serve.mjs')
const server = process.env.CHUNKLINE_URL ? await useShared(process.env.CHUNKLINE_URL) : await serve()

const state = () => ({
  budget: document.querySelector('[data-budget]')?.disabled ?? null,
  tokenizer: document.querySelector('[data-tokenizer]')?.disabled ?? null,
  busy: document.querySelector('.controls')?.getAttribute('aria-busy') ?? null,
  drawn: document.querySelectorAll('.rule').length,
  status: document.querySelector('[data-status]')?.textContent?.trim().slice(0, 60) ?? '',
})

try {
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e).split('\n')[0]))

  const cdp = await context.newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', { offline: false, ...THROTTLE })

  await page.goto(server.url, { waitUntil: 'commit' })
  await page.waitForSelector('[data-budget]', { timeout: 30_000 })

  const during = await page.evaluate(state)
  if (during.budget !== true || during.tokenizer !== true) {
    fail(
      `while the vocabulary was arriving the slider was disabled=${during.budget} and the select disabled=${during.tokenizer}`,
      'Both drive a tokenizer that is not here yet.',
    )
  } else {
    console.log(`  ok      both disabled while the vocabulary arrives, status ${JSON.stringify(during.status)}`)
  }
  if (during.busy !== 'true') fail(`.controls carried aria-busy=${JSON.stringify(during.busy)} during the fetch`)

  await page.waitForFunction(() => document.querySelector('[data-budget]')?.disabled === false, null, { timeout: 120_000 })
  const after = await page.evaluate(state)
  if (after.tokenizer !== false) fail('the slider became usable and the tokenizer select did not')
  if (after.busy !== null) fail(`.controls is still aria-busy=${JSON.stringify(after.busy)} with the vocabulary in hand`)
  if (after.drawn === 0) fail('the controls were enabled before anything had been drawn with the vocabulary')
  else console.log(`  ok      both usable once it is here, ${after.drawn} marks drawn`)

  /* And the second vocabulary, which is the same window again. */
  const other = await page.evaluate(() => {
    const s = document.querySelector('[data-tokenizer]')
    const pick = [...s.options].find((o) => o.value !== s.value)
    if (!pick) return null
    s.value = pick.value
    s.dispatchEvent(new Event('change', { bubbles: true }))
    return pick.value
  })
  if (other) {
    const held = await page.evaluate(state)
    if (held.budget !== true || held.tokenizer !== true) {
      fail(
        `choosing ${other} left the slider disabled=${held.budget} and the select disabled=${held.tokenizer}`,
        'The second vocabulary is another two megabytes, and the same throw waits at the end of it.',
      )
    } else {
      console.log(`  ok      choosing ${other} holds them until that vocabulary lands`)
    }
    await page.waitForFunction(() => document.querySelector('[data-budget]')?.disabled === false, null, { timeout: 120_000 })
  }

  if (errors.length > 0) fail(`${errors.length} uncaught page errors`, errors.slice(0, 2).join('; '))

  await browser.close()
} finally {
  server.stop()
}

if (failed > 0) {
  console.error('\nA control that cannot work yet and does not say so is a page that looks broken to the person using it.')
  process.exit(1)
}

console.log('ready: the controls are disabled exactly while the vocabulary behind them is not there')
