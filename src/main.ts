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
function boundariesOf(text: string, budget: number, id: TokenizerId): number[] {
  const enc = encoderFor(id)
  const ids = enc.encode(text)
  const cuts: number[] = []
  for (let i = budget; i < ids.length; i += budget) {
    cuts.push(enc.decode(ids.slice(0, i)).length)
  }
  return cuts
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
    rule.dataset.n = String(i + 1)
    rule.style.top = `${rect.bottom - top}px`
    host.append(rule)
  }
}

function render(): void {
  const budget = BUDGETS[Number(el.budget.value)]
  const id = el.tokenizer.value as TokenizerId
  el.budgetValue.textContent = `${budget}`

  const counts: Record<Lang, number> = { en: 0, el: 0 }
  for (const lang of LANGS) {
    const cuts = boundariesOf(passages[lang], budget, id)
    counts[lang] = cuts.length
    draw(lang, cuts)
  }

  const r = rates(id)
  el.metaEn.textContent = `${counts.en + 1} chunks, ${r.en.charsPerToken} characters a token`
  el.metaEl.textContent = `${counts.el + 1} chunks, ${r.el.charsPerToken} characters a token`

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

  el.budget.addEventListener('input', render)
  // The vocabulary is fetched before anything draws with it, and the line says
  // so, because on a slow connection this is a second and a half of nothing.
  el.tokenizer.addEventListener('change', async () => {
    const id = el.tokenizer.value as TokenizerId
    el.status.textContent = `fetching the ${id} vocabulary`
    await load(id)
    render()
  })

  el.status.textContent = 'fetching the o200k vocabulary'
  void load('o200k').then(render)
}

boot()
