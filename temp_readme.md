# Pretext

Pure JavaScript/TypeScript library for text measurement & layout. Fast, accurate & supports all the languages you didn't even know about. Allows rendering to DOM, Canvas, SVG and soon, server-side.

Pretext completely side-steps the need for DOM measurements (e.g. `getBoundingClientRect`, `offsetHeight`), which trigger layout reflow, one of the most expensive operations in the browser. See demos for layout out The Great Gatsby & other international books at >1000fps.

We're using AI to reimplement a subset of the font stack in userland, with the ground truth verifier that is browser rendering! If you're a text expert, please advise!

## Installation

tbd. Clone this repo and `bun install` for now

## API

Pretext caters to 2 use-cases:

### 1. Measure a paragraph's height _without ever touching DOM_

```ts
import { prepare, layout } from './src/layout.ts'

// >>> describe what prepare does
const prepared = prepare(commentText, '16px Inter') // >>> replace commentText with a good example,
const { height, lineCount } = layout(prepared, textWidth, 20) // pure arithmetics. No DOM layout & reflow!
```

`prepare()` is a one-time analysis pass. Our benchmark pages show it takes ~0.03ms for 500 texts on M2 Pro. >>> check whether this number's true
`layout()` should be called every time your `textWidth` changes. ~0.1ms for 500 texts

This supports all the languages you can imagine, including emojis and mixed-bidi, and caters to specific browser quirks

The returned height is the crucial last piece for unlocking web UI's:
- proper virtualization/occlusion without guesstimates & caching
- fancy userland layouts: masonry, JS-driven flexbox-like implementations, nudging a few layout values without CSS hacks (imagine that), etc.
- _development time_ verification (especially now with AI) that labels on e.g. buttons don't overflow to the next line

### 2. Lay out the paragraph lines manually yourself

```ts
import {
  prepareWithSegments,
  walkLineRanges,
  layoutNextLine,
  layoutWithLines,
} from './src/layout.ts'

const prepared = prepareWithSegments(storyText, '18px "Helvetica Neue"')

// >>> Fixed-width manual layout, no string materialization (this comment's bad. Follow our tone guideline and fix this. See ../vibescript/agents.md for tone)
walkLineRanges(prepared, 320, line => {
  console.log(line.width, line.start, line.end)
})
// >>> is this walkLineRanges example related to below or not...? what does it do here

// Variable-width manual layout, one row at a time:
let cursor = { segmentIndex: 0, graphemeIndex: 0 }
while (true) {
  const line = layoutNextLine(prepared, cursor, getWidthForCurrentRow())
  if (line === null) break
  placeLineManually(line)
  cursor = line.end
  // >>> when you see this, please discuss: I know We said no iterators, but this just feels like a worse iterator. Either we do iterator, or we should try another API format. I would like to brainstorm on the latter
}
```

This usage allows:
- even fancier layout possibilities. See the [Dynamic Layout](/pages/dynamic-layout.html) demo.
- rendering to canvas, SVG, WebGL and (eventually) server-side

## Caveats

Pretext doesn't try to be a full font rendering engine (yet?). It currently targets the common text setup:
- `white-space: normal`
- `word-break: normal`
- `overflow-wrap: break-word`
- explicit caller-provided `line-height` >>> provided where?

>>> something about system-ui maybe.

## Develop

>>> is this section stale?

```bash
bun install
bun start        # http://localhost:3000 — demo pages with full code reload (clears stale :3000 listeners first)
bun run check    # typecheck + lint
bun test         # lightweight invariants against the shipped implementation
bun run accuracy-check         # Chrome browser sweep
bun run accuracy-check:safari  # Safari browser sweep
bun run accuracy-check:firefox # Firefox browser sweep
bun run benchmark-check        # Chrome benchmark snapshot (short corpus + long-form corpora)
bun run corpus-font-matrix --id=ar-risalat-al-ghufran-part-1 --samples=5  # sampled cross-font corpus check
```

>>> is this section stale?
Pages:
- `/demo.html` — manual line-placement demo streamed from repeated `layoutNextLine()` calls
- `/dynamic-layout.html` — fixed-height editorial spread with a continuous two-column flow, obstacle-aware title routing, and live logo-driven reflow
- `/accuracy.html` — sweep across fonts, sizes, widths, i18n texts
- `/benchmark.html` — performance comparison
- `/bubbles.html` — bubble shrinkwrap demo
- `/emoji-test.html` — canvas vs DOM emoji width sweep
- `/corpus.html` — long-form corpora + diagnostics (`font=` / `lineHeight=` query params supported)

## Research

See [RESEARCH.md](RESEARCH.md) for the full exploration log: every approach we tried, benchmarks, the system-ui font discovery, punctuation accumulation error analysis, emoji width tables, HarfBuzz RTL bug, server-side engine comparison, and what Sebastian already knew.

## Credits

Sebastian Markbage's first gave the idea at [text-layout](https://github.com/chenglou/text-layout) last decade. Seb's design — canvas `measureText` for shaping, bidi algorithm from pdf.js, streaming line breaking — informed the architecture.
