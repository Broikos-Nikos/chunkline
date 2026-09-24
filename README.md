# chunkline

### A 1,024 token chunk holds four times more English than Greek.

LlamaIndex's default chunk is 1,024 tokens of `cl100k`. Measured on 477,858
characters of Wikipedia, that budget holds **4,731 characters of English and
1,157 of Greek**. The budget is the same number either way, and nothing in a
retrieval pipeline tells you it bought you a quarter of the document.

<!-- the picture goes here once npm run capture exists -->

Every cut is drawn on the text it cuts. Move the budget and the rules slide;
change the vocabulary and the Greek column loses or gains half its chunks while
the English one barely moves.

---

## The number, and the condition it comes with

| tokenizer | English | Greek | ratio |
|---|---|---|---|
| `o200k`, GPT-4o and the current models | 4.76 characters a token | 2.64 | **1.80x** |
| `cl100k`, GPT-4, GPT-3.5, most deployed retrieval | 4.62 | 1.13 | **4.09x** |

**The vocabulary matters more than the language does.** Moving from `cl100k` to
`o200k` recovers more than half the gap without changing a chunk size, a
splitter or a line of code, and it is the one thing on this page a reader can act
on the same afternoon.

Every figure above is computed from `src/generated/corpus.json`, which
`npm run check:corpus` regenerates from the committed text on every build.

## What this does not claim

**Not that every chunker cuts on tokens.** LangChain's own RAG tutorial chunks
at 1,000 **characters**, and a character budget holds the same amount of Greek
as English. This is about token budgets, which is what LlamaIndex defaults to
and what anything measuring context windows uses.

**Not that the cut lands worse in Greek in general.** Cutting every 512 token
ids, which is what this page draws, puts 92 of 164 Greek boundaries inside a
word against 13 of 105 English ones. Run LangChain's `RecursiveCharacterTextSplitter`
over the same text with the same budget and **both drop to zero**: it splits on
paragraph, line and space first. The separator fixes where the cut lands. It
does not give the Greek chunk any more text.

That second paragraph is the finding, and it is why the page leads with how much
text fits rather than with where the cut falls.

## The corpus

Four topics, each with a substantial article written independently in both
languages: a city, a science article, a history article, a technology one. Not
translations of each other, which is what makes this a comparison of writing
systems rather than of a translator.

The prose is committed, 648 KB of it, which CC BY-SA 4.0 allows with
attribution. Each article carries its revision id, the timestamp of that
revision, the date it was fetched, a link to it and its sha256.

It is committed because it has to be. The first version of this project fetched
the articles, recorded their revision ids and saved no text. Two English articles
were edited within a day, and re-running the same processing gave a different
answer: 13 boundaries inside a word where the file said 10. Both measurements
were honest. They were measurements of different documents.

```bash
npm run build:corpus    # refetch and re-measure. Changes the numbers. Not run by the build.
npm run check:corpus    # recompute every rate from the committed text. Run by every build.
```

## Run it

```bash
npm install
npm run dev         # then open the address it prints
npm run build       # typecheck, three file gates, then the bundle
npm run verify      # one browser gate against one shared server
```

## The gates

| gate | what it stops |
|---|---|
| `check:boundaries` | the rules drifting from the cuts, in any of the three ways they can |
| `check:corpus` | a rate drifting from the text it was measured on, or that text being edited |
| `check:source` | an invisible character in source, which once made a regex that could never match |

`check:boundaries` is the one this project exists to have. It computes the cuts
itself, in node, and holds three things to that answer: the committed offsets,
the page's own arithmetic, and **the rules as drawn**. For each rule it binary
searches for the character sitting on that line and compares it with the
character the tokenizer says the cut falls after, because a rule at the right
height for the wrong character passes a count check and is still a lie.

Every gate here was written with its failure reproduced first. Moving the rules
to the top of their line instead of the bottom fails it at 20 English and 35
Greek rules; editing one committed offset by 40 characters fails it by name.

## Licence

MIT for the code. The corpus is Wikipedia text under CC BY-SA 4.0, attributed
per article in `src/generated/corpus-text.json`.
