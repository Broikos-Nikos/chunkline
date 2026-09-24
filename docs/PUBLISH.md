# Publishing chunkline

Everything the repository needs to exist on GitHub, written down before the
repository is created so that creating it is a transcription rather than a
series of small decisions taken at the API.

## The About box

**Description**, 350 characters or fewer, and it has to carry the number:

> LlamaIndex chunks at 1,024 tokens by default. Measured on 477,858 characters of
> Wikipedia, that budget holds 4,731 characters of English and 1,157 of Greek.
> Every cut drawn on the text it cuts, in your browser, with the corpus committed
> so the numbers are reproducible from the clone.

**Homepage**: `https://broikos-nikos.github.io/chunkline/`

**Topics**, ten, the maximum GitHub shows without a fold:

```
chunking  rag  retrieval  tokenizer  greek  nlp
llm  data-visualization  reproducible-research  typescript
```

`greek` and `rag` are the two that matter. A person looking for what this
measures is searching one or the other, and the overlap between them is where
this project has something nobody else has bothered to measure.

## Settings

- **Public**, no wiki, no projects, no discussions. Issues on: a repository that
  publishes a measurement should be reachable by somebody who thinks it is wrong.
- **Pages**: source GitHub Actions, not a branch. The workflow builds, gates and
  deploys, and a branch source would publish whatever was committed regardless of
  whether the gates passed.
- **No default community files.** The MIT LICENSE is committed already, and
  `check:licence` fails if the README claims a licence the tree does not carry.

## The order, and why this order

1. **Create the repository** with the description, homepage and topics above, so
   the About box is never empty. `watch-it-think` shipped with an empty one and a
   recruiter audit filed it as a high finding: the ten second screen had no
   sentence on it.
2. **Push `main` with the whole history.** Seven commits, every one authored
   `Nikos Broikos <broikos.nikolaos@gmail.com>`, none co-authored. The history is
   the argument: it shows the corpus being committed after it was found to move,
   and the gates being written with their failures reproduced first.
3. **Turn Pages on** and let the workflow run. Nothing is deployed by hand.
4. **Open the live URL in a browser** and look at it, at 1280 and at 390. A 200
   from `curl` is not the same as a page that renders.
5. **Second push**: add the live link to the README, which is the one thing that
   cannot be written before the repository exists.

## What is deliberately not in the repository

- **No `dist`.** It is gitignored; the workflow builds it.
- **No `.capture`.** The recording's working directory, also gitignored.
- **No fetched Wikipedia payloads beyond the committed corpus.**
  `npm run build:corpus` refetches and is not run by the build, because it
  changes the numbers. The committed text is 648 KB and it is committed because
  the first version of this project saved revision ids and no text, and two
  articles were edited within a day.

## After it is live

`MAINTAIN-PROMPT.md` takes over for this repository the moment it exists, and
`BUILD-PROMPT.md` stops applying to it. The first maintenance tick checks the
deploy, opens the page, and works the queue: two open findings today, B2 and B4,
both about the page rather than the numbers, plus BPHONE-F1 filed last night
about the recording being a smear at phone width.
