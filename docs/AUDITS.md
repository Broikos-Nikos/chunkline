# The audits

Commit messages cite identifiers like `B6`. This is what they refer to.

Two audit passes and the workspace sweeps. The passes were run by a separate
agent against one assigned perspective, with no write access to the project.

**22 findings, 5 closed, 17 open**, across the 2 perspectives that produced them.

Held to the workspace queue this project is built from by
`tools/check-audit-status.mjs`, which fails if a row here says anything the
queue does not. Until tick 164 this file did not exist, and an identifier in a
sibling project's commit log pointed at nothing a reader could open.

## `CME`, measurement

The measurement auditor: is every number reproducible, is the sample size stated, is any comparison unfair.

4 findings, 4 closed.

| id | severity | status | finding |
|---|---|---|---|
| `CME-F1` | high | not reproduced, tick 150 | The mid word rate counts chunks that end in a letter, which is not the same thing |
| `CME-F2` | high | not reproduced, tick 150 | "2.07 times the tokens" bundles two different effects |
| `CME-F3` | high | not reproduced, tick 150 | The headline ratio is a property of one tokenizer and the spec does not say so |
| `CME-F4` | low | not reproduced, tick 149 | The 80 character line filter is even handed |

## `CME2`, measurement, second pass

The measurement auditor again, after the first pass had been answered, on the corpus behind the headline.

8 findings, 1 closed.

| id | severity | status | finding |
|---|---|---|---|
| `CME2-F1` | high | not reproduced, tick 150 | The corpus behind every rate on the page cannot be reproduced, and re-running its script today changes a headline number |
| `CME2-F2` | medium | open | The headline covers tutorials whose chunk size is not a token budget |
| `CME2-F3` | medium | open | The mid word rate is a property of the page's chunker, not of RAG chunking |
| `CME2-F4` | medium | open | The comparison the page is built on is not on the screen, and the cut inside a line is never drawn |
| `CME2-F5` | medium | open | Every rate on the page describes a sample the page never names |
| `CME2-F6` | low | open | The gate this project exists to have is run by nothing, and three scripts point at files that do not exist |
| `CME2-F7` | low | open | Ratios taken of numbers already rounded |
| `CME2-F8` | low | open | Two download figures in comments that the build contradicts |

## `self`, swept from elsewhere (not an audit pass)

Not a perspective and not an agent. Findings raised against this project while
a class found somewhere else in the workspace was being swept across all eight,
kept here because commit messages cite them like any other.

10 findings, 0 closed.

| id | severity | status | finding |
|---|---|---|---|
| `CCAP-F1` | medium | open | capture.mjs hands the committed GIF to ffmpeg and closes its browser outside a finally |
| `CCON-F1` | medium | open | The tokenizer select is bounded at 1.27:1 |
| `CGIF-F1` | medium | open | The picture at the top runs 8.76 seconds with a 1.62 second freeze in it |
| `CHEAD-F1` | medium | open | A forwarded link unfurls into a bare URL: no og tags anywhere in the head |
| `CNOT-F1` | medium | open | The bundle ships gpt-tokenizer and its licence travels with nothing |
| `CSIZE-F1` | medium | open | The README says the prose is 648 KB and the file is 646 KB, and nothing measures it |
| `B6` | low | open | 1px of horizontal overflow at 390: scrollWidth 391 against clientWidth 390 |
| `BCAP-F1` | low | open | check:capture caps the gif at 3.5 MB and the gif is 2.40 MB, so the ceiling permits silent growth |
| `BPHONE-F1` | low | open | At 356 pixels, the width a phone gives a README image, the passage text in docs/cuts.gif is a smear. The orange rules carry the argument and survive; the words do not |
| `CSAM-F1` | low | open | The headline states a measured ratio and the corpus it was measured on is in the next paragraph rather than in the sentence |
