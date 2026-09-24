/**
 * The two vocabularies, and why there are exactly two.
 *
 * The measurement audit on 2026-09-23 found that this project's headline number
 * is a property of the tokenizer and not of Greek: the same corpus gives a ratio
 * of 1.80 on `o200k` and 4.09 on `cl100k`, so Greek gets 55.6 percent of the
 * text per token on one and 24.5 on the other. A page that quoted one of those
 * would be making a claim about a vocabulary while appearing to make one about a
 * language.
 *
 * So the picker is not a control, it is the second half of the argument, and it
 * carries the two that matter: what current models use, and what an enormous
 * amount of already deployed retrieval still runs on.
 *
 * Loaded one at a time, and the first version of this file did not.
 *
 * Importing both at the top put **2.9 MB of javascript** into the first visit,
 * on a page whose entire subject is what tokens cost. The comment here argued
 * for it, that the page switches between them constantly, and the argument was
 * wrong in the way arguments about performance usually are: it was made without
 * the number. A vocabulary is about 1.5 MB and the second one is needed only
 * when somebody picks it.
 */

import type * as GPT from 'gpt-tokenizer/encoding/o200k_base'

export type TokenizerId = 'o200k' | 'cl100k'

export interface TokenizerMeta {
  id: TokenizerId
  name: string
  /** What a reader would recognise it by, which is not its name. */
  used: string
}

export const TOKENIZERS: TokenizerMeta[] = [
  { id: 'o200k', name: 'o200k', used: 'GPT-4o and the current models' },
  { id: 'cl100k', name: 'cl100k', used: 'GPT-4, GPT-3.5, and most deployed retrieval' },
]

export interface Encoder {
  encode(text: string): number[]
  decode(ids: number[]): string
}

const LOADERS: Record<TokenizerId, () => Promise<typeof GPT>> = {
  o200k: () => import('gpt-tokenizer/encoding/o200k_base'),
  cl100k: () => import('gpt-tokenizer/encoding/cl100k_base'),
}

const loaded = new Map<TokenizerId, Encoder>()

/** Fetch a vocabulary, once. Everything else here is synchronous on purpose. */
export async function load(id: TokenizerId): Promise<Encoder> {
  const have = loaded.get(id)
  if (have) return have
  const mod = await LOADERS[id]()
  const enc: Encoder = { encode: (t) => mod.encode(t), decode: (ids) => mod.decode(ids) }
  loaded.set(id, enc)
  return enc
}

/**
 * The encoder for an id that has already been loaded.
 *
 * Separate from `load` so that drawing stays synchronous: the boundaries are
 * recomputed on every slider move, and a promise in that path would let two
 * renders interleave and draw one language's rules against the other's text.
 */
export function encoderFor(id: TokenizerId): Encoder {
  const enc = loaded.get(id)
  if (!enc) throw new Error(`${id} was not loaded before it was drawn with`)
  return enc
}
