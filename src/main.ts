import './style.css'
import passageData from './generated/passage.json'
import corpusData from './generated/corpus.json'
import { TOKENIZERS, type TokenizerId, encoderFor, load } from './lib/tokenizers'

/**
 * Where a chunker cuts, drawn on the text it cuts.
 *
 * The argument this page makes, and the reason it is two columns rather than a
 * table: a token budget is a quantity of tokens, and a token is a different
 * amount of language depending on what language you wrote. Setting a budget of
 * 512 does not set an amount of text. It sets an amount of text **in English**,
 * and about half that in Greek.
 *
 * Everything drawn here comes from `src/generated/`, which was measured before
 * this page existed and is pinned to the Wikipedia revisions it was taken from.
 * The page recomputes the boundaries in the browser rather than reading the
 * precomputed ones, because a page that draws a committed answer is a picture of
 * a measurement rather than a measurement. The committed offsets are what
 * `check:boundaries` holds it to.
 */

const BUDGETS = [128, 256, 512, 1024] as const

const el = {
  headline: document.querySelector<HTMLElement>('[data-headline]')!,
  standfirst: document.querySelector<HTMLElement>('[data-standfirst]')!,
  budget: document.querySelector<HTMLInputElement>('[data-budget]')!,
  budgetValue: document.querySelector<HTMLOutputElement>('[data-budget-value]')!,
  budgets: document.querySelector<HTMLDataListElement>('#budgets')!,
  tokenizer: document.querySelector<HTMLSelectElement>('[data-tokenizer]')!,
  status: document.querySelector<HTMLElement>('[data-status]')!,
  caption: document.querySelector<HTMLElement>('[data-caption]')!,
  footer: document.querySelector<HTMLElement>('[data-footer]')!,
  glanceCaption: document.querySelector<HTMLElement>('[data-glance-caption]')!,
  glanceBars: {
    en: document.querySelector<HTMLElement>('[data-glance-bar="en"]')!,
    el: document.querySelector<HTMLElement>('[data-glance-bar="el"]')!,
  },
  glanceCounts: {
    en: document.querySelector<HTMLElement>('[data-glance-count="en"]')!,
    el: document.querySelector<HTMLElement>('[data-glance-count="el"]')!,
  },
  metaEn: document.querySelector<HTMLElement>('[data-meta-en]')!,
  metaEl: document.querySelector<HTMLElement>('[data-meta-el]')!,
  passages: {
    en: document.querySelector<HTMLElement>('[data-passage="en"]')!,
    el: document.querySelector<HTMLElement>('[data-passage="el"]')!,
  },
}

type Lang = 'en' | 'el'
const LANGS: Lang[] = ['en', 'el']

const passages: Record<Lang, string> = {
  en: passageData.passages.en.text,
  el: passageData.passages.el.text,
}

/** One tokenizer's measurements, as `tools/rates.mjs` writes them. */
interface Rate {
  characters: number
  tokens: number
  charsPerToken: number
  boundaries: number
  clean: number
  midSentence: number
  midWord: number
  midSentencePercent: number
  midWordPercent: number
}

/** What the corpus says about this tokenizer, for the numbers under the page. */
function rates(id: TokenizerId) {
  const c = corpusData.rates as Record<Lang, Record<string, Rate>>
  return { en: c.en[id], el: c.el[id] }
}

/**
 * Where the cuts fall, in characters, for this text at this budget.
 *
 * Decoding the prefix rather than summing token lengths, because a token is a
 * sequence of bytes and not a sequence of characters: a Greek word is often
 * several tokens whose byte boundaries fall inside a character, and adding up
 * `decode(t).length` per token gives an offset that drifts. Decoding the whole
 * prefix asks the only question that has a single answer, which is how much text
 * is in the first N tokens.
 */
/**
 * The corpus date in words, because a hyphenated date breaks across lines.
 *
 * Seen at 390 pixels on the first build of the footer: "fetched on 2026-09-" at
 * the end of one line and "24" at the start of the next, which reads as a typo
 * rather than as a date. The value still comes from `corpus.json`, so it cannot
 * drift from the text it describes.
 */
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
function fetchedOn(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const month = MONTHS[(m ?? 1) - 1]
  return month === undefined ? iso : `${d} ${month} ${y}`
}

function boundariesOf(text: string, budget: number, id: TokenizerId): { cuts: number[]; tokens: number } {
  const enc = encoderFor(id)
  const ids = enc.encode(text)
  const cuts: number[] = []
  for (let i = budget; i < ids.length; i += budget) {
    cuts.push(enc.decode(ids.slice(0, i)).length)
  }
  /*
   * The token count comes back with the cuts because it is the same encode.
   *
   * CME2-F5. The line above each column used to print `corpus.json`'s rate,
   * which is pooled over four article pairs, 256,155 characters of English and
   * 221,703 of Greek. What is in the column is one passage of about 11,900
   * characters, and it has its own rate. Measured at tick 185:
   *
   *     printed above the column      the column's own text
   *   o200k  en  4.76                 4.643
   *   o200k  el  2.64                 2.609
   *   cl100k en  4.62                 4.580
   *   cl100k el  1.13                 1.112
   *
   * A reader who divides the characters they can see by the tokens the page
   * says they cost gets a different number from the one over their head. So
   * the column prints its own, from this encode rather than from a file, and
   * the pooled figures stay in the standfirst and the footer, where the corpus
   * is named.
   */
  return { cuts, tokens: ids.length }
}

/**
 * Draw a rule across a column at a character offset.
 *
 * A `Range` over the text node up to that offset gives the rectangle of the
 * character sitting there, and the bottom of that rectangle is the line the cut
 * falls after. Proved on 2026-09-24 against this passage before any of this
 * existed: 68 rules across two budgets, none landed badly.
 */
function draw(lang: Lang, cuts: number[]): void {
  const host = el.passages[lang]
  host.textContent = passages[lang]
  const node = host.firstChild
  if (!node) return

  const top = host.getBoundingClientRect().top
  const range = document.createRange()

  for (const [i, offset] of cuts.entries()) {
    const at = Math.min(offset, passages[lang].length - 1)
    range.setStart(node, at)
    range.setEnd(node, at + 1)
    const rect = range.getBoundingClientRect()

    const rule = document.createElement('div')
    rule.className = 'rule'
    rule.dataset.rule = ''
    rule.dataset.n = String(i + 1)
    rule.style.top = `${rect.bottom - top}px`
    host.append(rule)

    /*
     * And where in that line the cut actually is.
     *
     * CME2-F4. The rule runs the width of the column, so it says which line a
     * chunk ends on and nothing about where, on a page whose subject is the
     * split word. Measured at tick 188 at 512 tokens on o200k: the cut sits
     * between 16 and 96 percent along its line, 28 characters of the next
     * chunk sit above the rule on average and up to 55, and seven of the eight
     * Greek cuts fall inside a word with nothing marking them.
     *
     * The mark comes off the same `Range` the rule's y came off, so it is the
     * character's own box rather than an estimate from a character width, and
     * `data-at` carries the offset so `check:cuts` can hold the coordinate
     * instead of trusting the drawing.
     */
    const text = passages[lang]
    const inside = LETTER.test(text[at] ?? '') && LETTER.test(text[at + 1] ?? '')
    const cut = document.createElement('div')
    cut.className = inside ? 'cut cut--word' : 'cut'
    cut.style.left = `${rect.left - host.getBoundingClientRect().left}px`
    cut.style.top = `${rect.top - top}px`
    cut.style.height = `${rect.height}px`
    cut.dataset.at = String(at)
    cut.dataset.inside = String(inside)
    host.append(cut)
  }
}

/** A letter either side of the cut is a cut inside a word. */
const LETTER = /\p{L}/u

/**
 * The whole comparison, small, above the fold.
 *
 * Both passages are within 25 characters of each other, so both bars are the
 * same width and the only difference between the rows is how many ticks sit on
 * them. A tick is a cut, placed at its character offset as a fraction of the
 * passage, and a cut inside a word is drawn louder because that is the thing
 * the page is about.
 */
function drawGlance(lang: Lang, cuts: number[]): void {
  const bar = el.glanceBars[lang]
  const text = passages[lang]
  bar.replaceChildren(
    ...cuts.map((at) => {
      const tick = document.createElement('div')
      const inside = LETTER.test(text[at] ?? '') && LETTER.test(text[at + 1] ?? '')
      tick.className = inside ? 'glance__tick glance__tick--word' : 'glance__tick'
      tick.dataset.tick = ''
      tick.style.left = `${((at / text.length) * 100).toFixed(3)}%`
      tick.dataset.at = String(at)
      tick.dataset.inside = String(inside)
      return tick
    }),
  )
  el.glanceCounts[lang].textContent = `${cuts.length + 1} chunks`
}

function render(): void {
  const budget = BUDGETS[Number(el.budget.value)]
  const id = el.tokenizer.value as TokenizerId
  el.budgetValue.textContent = `${budget}`

  const counts: Record<Lang, number> = { en: 0, el: 0 }
  const own: Record<Lang, number> = { en: 0, el: 0 }
  for (const lang of LANGS) {
    const { cuts, tokens } = boundariesOf(passages[lang], budget, id)
    counts[lang] = cuts.length
    own[lang] = passages[lang].length / tokens
    draw(lang, cuts)
    drawGlance(lang, cuts)
  }

  el.metaEn.textContent = `${counts.en + 1} chunks, ${own.en.toFixed(2)} characters a token`
  el.metaEl.textContent = `${counts.el + 1} chunks, ${own.el.toFixed(2)} characters a token`

  /* The caption under the bars says what a reader is looking at, in the one
     sentence the whole page exists to make. */
  el.glanceCaption.textContent =
    `The same passage in both languages, ${passages.en.length.toLocaleString('en-US')} and ` +
    `${passages.el.length.toLocaleString('en-US')} characters, cut every ${budget} ${id} tokens. ` +
    `Each tick is a cut; the brighter ones fall inside a word.`

  el.status.textContent =
    `${budget} tokens a chunk: ${counts.en + 1} chunks of English, ${counts.el + 1} of Greek, ` +
    `from the same subject at the same length.`

  el.caption.textContent =
    `Two articles on the Byzantine Empire, ${passageData.passages.en.characters.toLocaleString('en-US')} ` +
    `characters of English and ${passageData.passages.el.characters.toLocaleString('en-US')} of Greek. ` +
    `They are not translations of each other: each was written by speakers of its own language, which is ` +
    `what makes this a comparison of writing systems rather than of a translator. ` +
    `Wikipedia, CC BY-SA, revisions ${passageData.passages.en.revision} and ${passageData.passages.el.revision}.`
}

function boot(): void {
  /*
   * The headline is scoped to token budgets, and it names one.
   *
   * It used to read "every chunk size in every RAG tutorial is an English
   * number", and a reader who knows the field falsifies that with one link:
   * LangChain's own RAG tutorial chunks at 1,000 **characters**, and a character
   * budget holds the same amount of Greek as English. LlamaIndex's default is
   * 1,024 tokens of cl100k, which is concrete, checkable, and a stronger claim
   * than the one it replaces.
   */
  /*
   * "as much ... as", not "more ... than", quoted:
   * "four times more English than Greek" is five times as much. The budget
   * holds 4,731 English characters against 1,157, which is 4.09, so the loudest
   * sentence in the project ran 24 percent above its own measurement when read
   * the way it was written.
   */
  el.headline.textContent = 'A 1,024 token chunk holds four times as much English as Greek.'

  for (const b of BUDGETS) {
    const opt = document.createElement('option')
    opt.value = String(BUDGETS.indexOf(b))
    opt.label = String(b)
    el.budgets.append(opt)
  }

  for (const t of TOKENIZERS) {
    const opt = document.createElement('option')
    opt.value = t.id
    opt.textContent = `${t.name}, ${t.used}`
    el.tokenizer.append(opt)
  }
  el.tokenizer.value = 'o200k'

  /*
   * Every figure here is computed from the committed corpus rather than typed,
   * which is what check:claims holds the page to.
   */
  const cl = rates('cl100k')
  const o = rates('o200k')
  const at = (r: Rate, budget: number) => Math.round(budget * r.charsPerToken).toLocaleString('en-US')
  el.standfirst.textContent =
    `LlamaIndex's default chunk is 1,024 tokens of cl100k. Measured on ` +
    `${(cl.en.characters + cl.el.characters).toLocaleString('en-US')} characters of Wikipedia, ` +
    `that budget holds ${at(cl.en, 1024)} characters of English and ${at(cl.el, 1024)} of Greek. ` +
    `On o200k the gap halves, to ${(o.en.charsPerToken / o.el.charsPerToken).toFixed(1)} times. ` +
    `The budget is the same number either way.`

  /*
   * The footer names the sample, because until tick 185 nothing did.
   *
   * CME2-F5. Two different measurements sit on this page. The columns are one
   * pair of articles and now print their own rate; the standfirst quotes the
   * whole corpus, which is four pairs. Both are honest and they are different
   * numbers, so a reader who notices they differ is told why rather than left
   * to decide one of them is wrong. This element was in the markup from the
   * first commit and was never written to.
   *
   * The article count and the subjects come from `corpus.json` rather than
   * from the prose, because the prose is 477 KB on a page that costs 8 KB, and
   * `check:corpus` holds both against the committed text.
   */
  el.footer.textContent =
    `The two rates on this page are measured on different text. Each column prints its own, for the ` +
    `passage in it. The standfirst is the whole corpus: ${corpusData.articles} Wikipedia articles, ` +
    `${corpusData.topics.length} subjects in both languages, ` +
    `${(cl.en.characters + cl.el.characters).toLocaleString('en-US')} characters, fetched on ` +
    `${fetchedOn(corpusData.built)} and committed with each article's revision id and sha256. Every ` +
    `figure here is recomputed from that committed text by npm run check:corpus.`

  el.budget.addEventListener('input', render)
  // The vocabulary is fetched before anything draws with it, and the line says
  // so, because on a slow connection this is a second and a half of nothing.
  el.tokenizer.addEventListener('change', async () => {
    const id = el.tokenizer.value as TokenizerId
    el.status.textContent = `fetching the ${id} vocabulary`
    busy()
    await load(id)
    ready()
    render()
  })

  el.status.textContent = 'fetching the o200k vocabulary'
  void load('o200k').then(() => {
    ready()
    render()
  })
}

/**
 * The controls start working when there is something behind them.
 *
 * They ship disabled in index.html, because until this resolves the slider
 * drives `render()`, which calls `encoderFor`, which throws inside a listener
 * where a visitor sees nothing at all.
 */
function ready() {
  el.budget.disabled = false
  el.tokenizer.disabled = false
  document.querySelector('.controls')?.removeAttribute('aria-busy')
}

/** And stop working while a second vocabulary is on its way, for the same reason. */
function busy() {
  el.budget.disabled = true
  el.tokenizer.disabled = true
  document.querySelector('.controls')?.setAttribute('aria-busy', 'true')
}

boot()
