import { layoutNextLine, prepareWithSegments, type LayoutCursor, type PreparedTextWithSegments } from '../src/layout.ts'

const BODY_FONT = '16px "Helvetica Neue", Helvetica, Arial, sans-serif'
const BODY_LINE_HEIGHT = 25
const MOBILE_BODY_FONT = '14.5px "Helvetica Neue", Helvetica, Arial, sans-serif'
const MOBILE_BODY_LINE_HEIGHT = 22

const LEFT_COPY = `
Some marks feel as if they were drawn to live in the margin. They do not interrupt the reading so much as redirect it, creating a second current alongside the text. What begins as a plain column turns into a route with memory: a turn inward here, a pocket of air there, a sentence held a little longer because the page suddenly narrows and asks for another rhythm.

That is the appeal of contouring by hand. The layout is still disciplined, still typographic, but it stops pretending every paragraph must occupy the same indifferent rectangle. A logo, a silhouette, a small interruption in the field: these become reasons for the prose to bend and recover. The reader feels the shape without needing to think about geometry at all.
`.trim().replace(/\s+/gu, ' ') + ' ' + `
The result should not look fussy. Tiny jagged turns make the eye nervous, so the line wants broader gestures and longer sweeps, more dune than puzzle piece. The white space has to feel intentional. It should seem as if the copy always meant to pass beside the emblem, as if the emblem simply revealed a latent curve already present inside the paragraph.

And when the window shifts, the arrangement should answer with another poised state, not a frantic animation. The shape stays itself; the text discovers another way around it. That is the kind of page we are after: calm, explicit, and fully owned in userland.
`.trim().replace(/\s+/gu, ' ')

const RIGHT_COPY = `
A second column changes the feeling again. The eye can shuttle across the gutter, compare two contours, notice how one symbol opens upward while another settles into the lower edge of the page. The composition becomes less like a block of text and more like a spread: not decorative exactly, but arranged with enough confidence that reading and looking begin to support one another.

This is also why the details matter. If the exclusion zone is too timid, the lines scrape the logo and the whole effect collapses. If the gap between columns is too generous, the page loses tension. If the body type is too large, the prose feels crowded before the contour has a chance to breathe. Small corrections change the page more than extra ornament ever could.
`.trim().replace(/\s+/gu, ' ') + ' ' + `
So this little exercise is deliberately spare: one headline, two symbols, two streams of text, and enough room for the layout algorithm to show its hand. No fake chrome, no surrounding explanation, no scrolling tricks to distract from the basic question. Can the page hold its shape? Can the prose wrap beautifully? Can the composition feel authored rather than merely computed?

If the answer is yes, then the technical story starts to become a visual one. We stop talking only about line counts and benchmarks and begin talking about spreads, anchors, side notes, pull quotes, and pages that stay alive as the width changes. That is when the layout engine stops being a measurement trick and starts becoming a medium.
`.trim().replace(/\s+/gu, ' ')

type Rect = {
  x: number
  y: number
  width: number
  height: number
}

type Interval = {
  left: number
  right: number
}

type MaskRow = {
  left: number
  right: number
}

type ImageMask = {
  width: number
  height: number
  rows: Array<MaskRow | null>
}

const stage = document.getElementById('stage') as HTMLDivElement
const headline = document.getElementById('headline') as HTMLHeadingElement
const openaiLogo = document.getElementById('openai-logo') as HTMLImageElement
const claudeLogo = document.getElementById('claude-logo') as HTMLImageElement

const preparedByKey = new Map<string, PreparedTextWithSegments>()
const scheduled = { value: false }

function getTypography(): { font: string, lineHeight: number } {
  if (window.innerWidth <= 900) {
    return { font: MOBILE_BODY_FONT, lineHeight: MOBILE_BODY_LINE_HEIGHT }
  }
  return { font: BODY_FONT, lineHeight: BODY_LINE_HEIGHT }
}

function getPrepared(text: string, font: string): PreparedTextWithSegments {
  const key = `${font}::${text}`
  const cached = preparedByKey.get(key)
  if (cached !== undefined) return cached
  const prepared = prepareWithSegments(text, font)
  preparedByKey.set(key, prepared)
  return prepared
}

async function makeImageMask(src: string, width: number, height: number): Promise<ImageMask> {
  const image = new Image()
  image.src = src
  await image.decode()

  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')
  if (ctx === null) throw new Error('2d context unavailable')

  ctx.clearRect(0, 0, width, height)
  ctx.drawImage(image, 0, 0, width, height)

  const { data } = ctx.getImageData(0, 0, width, height)
  const rows: Array<MaskRow | null> = new Array(height)

  for (let y = 0; y < height; y++) {
    let left = width
    let right = -1
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3]!
      if (alpha < 12) continue
      if (x < left) left = x
      if (x > right) right = x
    }
    rows[y] = right >= left ? { left, right: right + 1 } : null
  }

  return { width, height, rows }
}

function getMaskIntervalForBand(
  mask: ImageMask,
  rect: Rect,
  bandTop: number,
  bandBottom: number,
  horizontalPadding: number,
  verticalPadding: number,
): Interval | null {
  if (bandBottom <= rect.y || bandTop >= rect.y + rect.height) return null

  const startRow = Math.max(0, Math.floor(bandTop - rect.y - verticalPadding))
  const endRow = Math.min(mask.height - 1, Math.ceil(bandBottom - rect.y + verticalPadding))

  let left = mask.width
  let right = -1

  for (let rowIndex = startRow; rowIndex <= endRow; rowIndex++) {
    const row = mask.rows[rowIndex]
    if (row === null || row === undefined) continue
    if (row.left < left) left = row.left
    if (row.right > right) right = row.right
  }

  if (right < left) return null

  return {
    left: rect.x + left - horizontalPadding,
    right: rect.x + right + horizontalPadding,
  }
}

function subtractIntervals(base: Interval, intervals: Interval[]): Interval[] {
  let slots: Interval[] = [base]

  for (const interval of intervals) {
    const next: Interval[] = []
    for (const slot of slots) {
      if (interval.right <= slot.left || interval.left >= slot.right) {
        next.push(slot)
        continue
      }
      if (interval.left > slot.left) {
        next.push({ left: slot.left, right: interval.left })
      }
      if (interval.right < slot.right) {
        next.push({ left: interval.right, right: slot.right })
      }
    }
    slots = next
  }

  return slots.filter(slot => slot.right - slot.left >= 24)
}

function renderColumn(
  prepared: PreparedTextWithSegments,
  region: Rect,
  font: string,
  lineHeight: number,
  maskRect: Rect,
  mask: ImageMask,
  maskPadding: { horizontal: number, vertical: number },
  lineClassName: string,
  side: 'left' | 'right',
): void {
  let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 }
  let lineTop = region.y

  while (true) {
    if (lineTop + lineHeight > region.y + region.height) break

    const bandTop = lineTop
    const bandBottom = lineTop + lineHeight
    const blocked: Interval[] = []
    const maskInterval = getMaskIntervalForBand(
      mask,
      maskRect,
      bandTop,
      bandBottom,
      maskPadding.horizontal,
      maskPadding.vertical,
    )
    if (maskInterval !== null) blocked.push(maskInterval)

    const slots = subtractIntervals(
      { left: region.x, right: region.x + region.width },
      blocked,
    )
    if (slots.length === 0) {
      lineTop += lineHeight
      continue
    }

    const slot = side === 'left'
      ? slots[slots.length - 1]!
      : slots[0]!
    const width = slot.right - slot.left
    const line = layoutNextLine(prepared, cursor, width)
    if (line === null) break

    const el = document.createElement('div')
    el.className = lineClassName
    el.textContent = line.text
    el.style.left = `${Math.round(slot.left)}px`
    el.style.top = `${Math.round(lineTop)}px`
    el.style.font = font
    el.style.lineHeight = `${lineHeight}px`
    stage.appendChild(el)

    cursor = line.end
    lineTop += lineHeight
  }
}

function clearRenderedLines(): void {
  const lines = stage.querySelectorAll('.line')
  lines.forEach(line => {
    line.remove()
  })
}

async function render(): Promise<void> {
  const { font, lineHeight } = getTypography()
  const pageWidth = window.innerWidth
  const pageHeight = Math.max(window.innerHeight, 980)

  stage.style.minHeight = `${pageHeight}px`

  const gutter = Math.round(Math.max(52, pageWidth * 0.048))
  const centerGap = Math.round(Math.max(34, pageWidth * 0.038))
  const headlineTop = Math.round(Math.max(42, pageHeight * 0.065))
  const headlineWidth = Math.round(Math.min(pageWidth - gutter * 2, pageWidth * 0.62))
  const copyTop = headlineTop + Math.round(Math.max(142, pageWidth * 0.122))
  const columnWidth = Math.round((pageWidth - gutter * 2 - centerGap) / 2)
  const columnHeight = pageHeight - copyTop - gutter

  const leftRegion: Rect = {
    x: gutter,
    y: copyTop,
    width: columnWidth,
    height: columnHeight,
  }

  const rightRegion: Rect = {
    x: gutter + columnWidth + centerGap,
    y: copyTop,
    width: columnWidth,
    height: columnHeight,
  }

  const openaiSize = Math.round(Math.max(260, Math.min(390, pageWidth * 0.25)))
  const openaiRect: Rect = {
    x: leftRegion.x - Math.round(openaiSize * 0.06),
    y: pageHeight - gutter - openaiSize + Math.round(openaiSize * 0.03),
    width: openaiSize,
    height: openaiSize,
  }

  const claudeSize = Math.round(Math.max(220, Math.min(340, pageWidth * 0.21)))
  const claudeRect: Rect = {
    x: rightRegion.x + rightRegion.width - Math.round(claudeSize * 0.61),
    y: Math.round(Math.max(36, headlineTop - 4)),
    width: claudeSize,
    height: claudeSize,
  }

  headline.style.left = `${gutter}px`
  headline.style.top = `${headlineTop}px`
  headline.style.width = `${headlineWidth}px`

  openaiLogo.style.left = `${openaiRect.x}px`
  openaiLogo.style.top = `${openaiRect.y}px`
  openaiLogo.style.width = `${openaiRect.width}px`
  openaiLogo.style.height = `${openaiRect.height}px`

  claudeLogo.style.left = `${claudeRect.x}px`
  claudeLogo.style.top = `${claudeRect.y}px`
  claudeLogo.style.width = `${claudeRect.width}px`
  claudeLogo.style.height = `${claudeRect.height}px`

  clearRenderedLines()

  const [openaiMask, claudeMask] = await Promise.all([
    makeImageMask(openaiLogo.src, openaiRect.width, openaiRect.height),
    makeImageMask(claudeLogo.src, claudeRect.width, claudeRect.height),
  ])

  renderColumn(
    getPrepared(LEFT_COPY, font),
    leftRegion,
    font,
    lineHeight,
    openaiRect,
    openaiMask,
    { horizontal: Math.round(lineHeight * 1.15), vertical: Math.round(lineHeight * 0.45) },
    'line line--left',
    'left',
  )

  renderColumn(
    getPrepared(RIGHT_COPY, font),
    rightRegion,
    font,
    lineHeight,
    claudeRect,
    claudeMask,
    { horizontal: Math.round(lineHeight * 1.05), vertical: Math.round(lineHeight * 0.42) },
    'line line--right',
    'right',
  )
}

function scheduleRender(): void {
  if (scheduled.value) return
  scheduled.value = true
  requestAnimationFrame(() => {
    scheduled.value = false
    void render()
  })
}

window.addEventListener('resize', scheduleRender)
void document.fonts.ready.then(() => {
  scheduleRender()
})
scheduleRender()
