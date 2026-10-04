/**
 * One definition of every rate, used by the builder and by the gate.
 *
 * It lives here rather than in either of them because two copies of an
 * arithmetic definition drift, and a gate that recomputes a number with its own
 * copy of the formula is checking that two files agree about a bug.
 */

import { encode as encodeO200k, decode as decodeO200k } from 'gpt-tokenizer/encoding/o200k_base'
import { encode as encodeCl100k, decode as decodeCl100k } from 'gpt-tokenizer/encoding/cl100k_base'

export const CODECS = {
  o200k: { encode: encodeO200k, decode: decodeO200k },
  cl100k: { encode: encodeCl100k, decode: decodeCl100k },
}

/** A boundary is clean when the chunk ends where a sentence ends. */
const CLEAN = /[.!?;·:]["')\]»]?$/
/** And inside a word when the chunk ends with a letter and the next begins with one. */
const ENDS_LETTER = /\p{L}$/u
const STARTS_LETTER = /^\p{L}/u

export function rateFor(text, name, budget) {
  const tk = CODECS[name]
  const ids = tk.encode(text)
  const chunks = []
  for (let i = 0; i < ids.length; i += budget) chunks.push(tk.decode(ids.slice(i, i + budget)))

  const n = chunks.length - 1
  let clean = 0
  let midWord = 0
  for (let i = 0; i < n; i++) {
    if (CLEAN.test(chunks[i].trimEnd())) clean++
    if (ENDS_LETTER.test(chunks[i]) && STARTS_LETTER.test(chunks[i + 1])) midWord++
  }

  return {
    characters: text.length,
    tokens: ids.length,
    charsPerToken: +(text.length / ids.length).toFixed(2),
    boundaries: n,
    clean,
    midSentence: n - clean,
    midWord,
    midSentencePercent: +((100 * (n - clean)) / n).toFixed(1),
    midWordPercent: +((100 * midWord) / n).toFixed(1),
  }
}

/**
 * The same text under the splitter LangChain actually ships.
 *
 * `CME2-F3`. The README answers the measurement audit with "run LangChain's
 * `RecursiveCharacterTextSplitter` over the same text with the same budget and
 * both drop to zero", and until tick 187 no command here produced that zero. It
 * was the auditor's number, typed into prose, on a page whose argument is that
 * a number comes from a command. The fix for a finding cannot itself be a claim
 * the repository cannot reproduce.
 *
 * ## What this implements, and how faithfully
 *
 * `RecursiveCharacterTextSplitter` with the default separators, `"\n\n"`,
 * `"\n"`, `" "`, `""`, and a token length function, which is what
 * `from_tiktoken_encoder` hands it. The algorithm, from the library's own
 * `_split_text`: split on the first separator that occurs in the text, keep
 * every piece that already fits, recurse into the ones that do not with the
 * next separator, then merge neighbouring pieces back up to the budget.
 *
 * Two places it is not identical to the Python, both named rather than hidden.
 * The library keeps a separator at the start of a piece when `keep_separator`
 * is set, and this splitter's default is to drop it, which is what this does.
 * And the library's merge can run a chunk a little over the budget, because it
 * measures its pieces separately: the audit saw chunks of 513 and 515 tokens
 * and called that "how LangChain behaves, not a harness fault". This merge
 * checks the joined candidate before accepting it, so it never exceeds, and
 * `overBudget` reports 0 where the audit's harness reported a few. The
 * difference changes no boundary count here, and it is written down rather
 * than smoothed over, because a harness that is tidier than the thing it
 * models should say where.
 *
 * The point of having it is not the splitter. It is that the page's second
 * number, "how much worse the cut is", belongs to the chunker and not to Greek,
 * and the only way to say so honestly is to print what a real splitter does to
 * the same text.
 */
export function recursiveFor(text, name, budget) {
  const tk = CODECS[name]
  const size = (s) => tk.encode(s).length

  const split = (s, seps) => {
    if (size(s) <= budget) return s === '' ? [] : [s]
    const [sep, ...rest] = seps
    if (sep === undefined) return s === '' ? [] : [s]
    const pieces = sep === '' ? [...s] : s.split(sep)
    const out = []
    for (const piece of pieces) {
      if (piece === '') continue
      if (size(piece) <= budget) out.push(piece)
      else out.push(...split(piece, rest))
    }
    return out
  }

  /* Merge back up to the budget, joined by the separator that split them, which
     is what `_merge_splits` does. The joiner is a space here because that is
     the separator every piece this corpus produces was split on. */
  const merge = (pieces, joiner) => {
    const chunks = []
    let current = ''
    for (const piece of pieces) {
      const candidate = current === '' ? piece : current + joiner + piece
      if (current !== '' && size(candidate) > budget) {
        chunks.push(current)
        current = piece
      } else {
        current = candidate
      }
    }
    if (current !== '') chunks.push(current)
    return chunks
  }

  const chunks = merge(split(text, ['\n\n', '\n', ' ', '']), ' ')

  /*
   * Where the cut lands in the source, not where the chunk strings end.
   *
   * The first run of this reported 87 of 105 English boundaries inside a word
   * against the fixed chunker's 13, which is backwards, and the reason is the
   * whole subtlety of comparing two chunkers. `rateFor` slices token ids and
   * decodes them, so the chunks reconstitute the text exactly and a boundary
   * inside a word really does leave chunk i ending in a letter and chunk i+1
   * starting with one. A recursive splitter eats its separator, so **every**
   * boundary looks like that: the space that proves the cut was clean is the
   * character consumed to make it.
   *
   * So the test asks the source. Each chunk is located in the text from a
   * moving cursor, and the cut is inside a word when the character before the
   * chunk's first character is a letter and that first character is one too.
   * The same question `rateFor` asks, asked where the answer survives.
   */
  let cursor = 0
  const starts = []
  for (const c of chunks) {
    const at = text.indexOf(c, cursor)
    starts.push(at)
    cursor = at < 0 ? cursor : at + c.length
  }

  const n = chunks.length - 1
  let clean = 0
  let midWord = 0
  let over = 0
  let unplaced = 0
  for (let i = 0; i < n; i++) {
    if (CLEAN.test(chunks[i].trimEnd())) clean++
    const at = starts[i + 1]
    if (at === undefined || at <= 0) {
      unplaced++
      continue
    }
    if (ENDS_LETTER.test(text[at - 1]) && STARTS_LETTER.test(text[at])) midWord++
  }
  for (const c of chunks) if (size(c) > budget) over++

  return {
    boundaries: n,
    clean,
    midWord,
    midWordPercent: n === 0 ? 0 : +((100 * midWord) / n).toFixed(1),
    /* How many chunks ran past the budget, because the audit saw this and it is
       the library's behaviour rather than a fault here. Printed so that nobody
       has to rediscover it. */
    overBudget: over,
    /* Chunks this could not find in the source. Must be zero, or the mid word
       count above saw fewer boundaries than there are. */
    unplaced,
  }
}
