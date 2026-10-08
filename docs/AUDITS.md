# The audits

Commit messages cite identifiers like `B6`. This is what they refer to.

Two audit passes and the workspace sweeps. The passes were run by a separate
agent against one assigned perspective, with no write access to the project.

**35 findings, 22 closed, 13 open**, across the 2 perspectives that produced them.

Held to the workspace queue this project is built from by
`tools/check-audit-status.mjs`, which fails if a row here says anything the
queue does not.

## `CME`, measurement

The measurement auditor: is every number reproducible, is the sample size stated,
is any comparison unfair.

4 findings, 4 closed.

| id | severity | status | finding |
|---|---|---|---|
| `CME-F1` | high | not reproduced, tick 150 | The mid word rate counts chunks that end in a letter, which is not the same thing |
| `CME-F2` | high | not reproduced, tick 150 | "2.07 times the tokens" bundles two different effects |
| `CME-F3` | high | not reproduced, tick 150 | The headline ratio is a property of one tokenizer and the spec does not say so |
| `CME-F4` | low | not reproduced, tick 149 | The 80 character line filter is even handed |

## `CME2`, measurement, second pass

The measurement auditor again, after the first pass had been answered, on the
corpus behind the headline.

8 findings, 5 closed.

| id | severity | status | finding |
|---|---|---|---|
| `CME2-F1` | high | not reproduced, tick 150 | The corpus behind every rate on the page cannot be reproduced, and re-running its script today changes a headline number |
| `CME2-F2` | medium | fixed, tick 186 | The headline covers tutorials whose chunk size is not a token budget |
| `CME2-F3` | medium | fixed, tick 187 | The mid word rate is a property of the page's chunker, not of RAG chunking |
| `CME2-F4` | medium | fixed, tick 188 | The comparison the page is built on is not on the screen, and the cut inside a line is never drawn |
| `CME2-F5` | medium | fixed, tick 185 | Every rate on the page describes a sample the page never names |
| `CME2-F6` | low | open | The gate this project exists to have is run by nothing, and three scripts point at files that do not exist |
| `CME2-F7` | low | open | Ratios taken of numbers already rounded |
| `CME2-F8` | low | open | Two download figures in comments that the build contradicts |

## `self`, swept from elsewhere (not an audit pass)

Not a perspective and not an agent. Findings raised against this project while
a class found somewhere else in the workspace was being swept across all eight,
kept here because commit messages cite them like any other.

23 findings, 13 closed.

| id | severity | status | finding |
|---|---|---|---|
| `CCAP-F1` | medium | fixed, tick 226 | capture.mjs hands the committed GIF to ffmpeg and closes its browser outside a finally |
| `CCON-F1` | medium | fixed, tick 176 | The tokenizer select is bounded at 1.27:1 |
| `CFIT-F1` | medium | fixed, tick 188 | Tick 186 lengthened an option label and took the page 55 pixels wider than a phone |
| `CGIF-F1` | medium | open | The picture at the top runs 8.76 seconds with a 1.62 second freeze in it |
| `CGRP-F1` | medium | fixed, tick 182 | serve.mjs kills a process group the spawn never creates, so cleanup off Windows leaves the server running |
| `CHEAD-F1` | medium | open | A forwarded link unfurls into a bare URL: no og tags anywhere in the head |
| `CLANG-F1` | medium | fixed, tick 177 | The Greek column is six hundred characters of Greek declared as English |
| `CNET-F1` | medium | fixed, tick 190 | index.html says the page tokenises text in your browser, and nothing holds it |
| `CNOT-F1` | medium | open | The bundle ships gpt-tokenizer and its licence travels with nothing |
| `CSIZE-F1` | medium | open | The README says the prose is 648 KB and the file is 646 KB, and nothing measures it |
| `CPRE-F2` | medium | fixed, tick 166 | Both controls shipped usable while the two megabyte vocabulary behind them was still arriving |
| `B6` | low | open | 1px of horizontal overflow at 390: scrollWidth 391 against clientWidth 390 |
| `BCAP-F1` | low | open | check:capture caps the gif at 3.5 MB and the gif is 2.40 MB, so the ceiling permits silent growth |
| `BPHONE-F1` | low | open | At 356 pixels, the width a phone gives a README image, the passage text in docs/cuts.gif is a smear. The orange rules carry the argument and survive; the words do not |
| `CCNT-F1` | low | open | The gate counts in the README and the workflow are written by hand and nothing holds them |
| `CENC-F1` | low | fixed, tick 186 | check:capture pinned every visible string on the page except the vocabulary picker |
| `CPRE-F1` | low | fixed, tick 165 | npm run verify started a server and handed the same missing browser to every gate in turn |
| `CRATE-F1` | low | fixed, tick 185 | The claims gate carried the counting sentence over the loop that only compares to zero |
| `CREC-F1` | low | fixed, tick 187 | The mid word test was applied to a chunker whose separator it had already consumed |
| `CSAM-F1` | low | open | The headline states a measured ratio and the corpus it was measured on is in the next paragraph rather than in the sentence |
| `CTAP-F1` | low | open | Controls shorter than 24 pixels at a phone width |
| `CENC-F2` | low | fixed, tick 186 | check-encodings read its own comment as the claim it was asserting about |
| `CFF-F1` | low | fixed, tick 226 | npm run capture resolves ffmpeg off PATH and asks for it only after the browser has launched |
