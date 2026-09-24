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
